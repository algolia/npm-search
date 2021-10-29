import type { SearchClient, SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';
import chalk from 'chalk';

import type { StateManager } from './StateManager';
import * as algolia from './algolia';
import { config } from './config';
import * as npm from './npm';
import type { PrefetchedPkg } from './npm/Prefetcher';
import { Prefetcher } from './npm/Prefetcher';
import { isFailure } from './npm/types';
import { saveDoc } from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';
import { wait } from './utils/wait';

let prefetcher: Prefetcher;
let consumer: QueueObject<PrefetchedPkg>;

/**
 * Bootstrap is the mode that goes from 0 to all the packages in NPM
 * In other word it is reindexing everything from scratch.
 *
 * It is useful if:
 *  - you are starting this project for the first time
 *  - you messed up with your Algolia index
 *  - you lagged too much behind.
 *
 * Watch mode should/can be reliably left running for weeks/months as CouchDB is made for that.
 * BUT for the moment it's mandatory to relaunch it because it's the only way to update: typescript, downloads stats.
 */
export async function run(
  stateManager: StateManager,
  algoliaClient: SearchClient,
  mainIndex: SearchIndex,
  bootstrapIndex: SearchIndex
): Promise<void> {
  log.info('-----');
  log.info('⛷   Bootstrap: starting');
  const state = await stateManager.check();

  if (state.seq && state.seq > 0 && state.bootstrapDone === true) {
    await algolia.putDefaultSettings(mainIndex, config);
    log.info('⛷   Bootstrap: done');
    log.info('-----');
    return;
  }

  await stateManager.save({
    stage: 'bootstrap',
  });

  const { seq, nbDocs: totalDocs } = await npm.getInfo();
  if (!state.bootstrapLastId) {
    // Start from 0
    log.info('⛷   Bootstrap: starting from the first doc');
    // first time this launches, we need to remember the last seq our bootstrap can trust
    await stateManager.save({ seq });
    await algolia.putDefaultSettings(bootstrapIndex, config);
  } else {
    log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
  }

  log.info('-----');
  log.info(chalk.yellowBright`Total packages: ${totalDocs}`);
  log.info('-----');

  prefetcher = new Prefetcher({
    nextKey: state.bootstrapLastId,
  });
  prefetcher.launch();

  let done = 0;
  consumer = createPkgConsumer(stateManager, bootstrapIndex);
  consumer.unsaturated(async () => {
    const next = await prefetcher.getNext();
    consumer.push(next);
    done += 1;
  });
  consumer.buffer = 0;

  let processing = true;
  while (processing) {
    logProgress(done);

    await wait(config.prefetchWaitBetweenPage);

    processing = !prefetcher.isFinished;
    done = 0;

    // Push nothing to trigger event
    consumer.push(null as any);
  }

  if (consumer.length() > 0) {
    // While we no longer are in "processing" mode
    //  it can be possible that there's a last iteration in the queue
    await consumer.drain();
  }

  consumer.kill();

  await stateManager.save({
    bootstrapDone: true,
    bootstrapLastDone: Date.now(),
  });

  await moveToProduction(stateManager, algoliaClient);

  log.info('-----');
  log.info('⛷   Bootstrap: done');
  log.info('-----');
}

/**
 * Move algolia index to prod.
 */
async function moveToProduction(
  stateManager: StateManager,
  algoliaClient: SearchClient
): Promise<void> {
  log.info('🚚  starting move to production');

  const currentState = await stateManager.get();
  await algoliaClient
    .copyIndex(config.bootstrapIndexName, config.indexName)
    .wait();

  await stateManager.save(currentState);
}

/**
 * Log approximate progress.
 */
async function logProgress(nbDocs: number): Promise<void> {
  const { nbDocs: totalDocs } = await npm.getInfo();
  const offset = prefetcher.offset;

  log.info(
    chalk.dim.italic
      .white`[progress] %d/%d docs (%s%) (%s prefetched) (%s processing)`,
    offset + nbDocs,
    totalDocs,
    ((Math.max(offset + nbDocs, 1) / totalDocs) * 100).toFixed(2),
    prefetcher.idleCount,
    consumer.running()
  );
}

/**
 * Consume packages.
 */
function createPkgConsumer(
  stateManager: StateManager,
  index: SearchIndex
): QueueObject<PrefetchedPkg> {
  return queue<PrefetchedPkg>(async (pkg) => {
    if (!pkg) {
      return;
    }

    log.info(`Start:`, pkg.id);
    const start = Date.now();

    try {
      datadog.increment('packages');

      const res = await npm.getDoc(pkg.id, pkg.value.rev);

      if (isFailure(res)) {
        log.error('Got an error', res.error);
        return;
      }

      await saveDoc({ row: res, index });

      const lastId = (await stateManager.get()).bootstrapLastId;

      // Because of concurrency we can have processed a package after in the list but sooner in the process.
      if (!lastId || lastId < pkg.id) {
        await stateManager.save({
          bootstrapLastId: pkg.id,
        });
      }
    } catch (err) {
      sentry.report(err);
    } finally {
      log.info(`Done:`, pkg.id);
      datadog.timing('loop', Date.now() - start);
    }
  }, config.bootstrapConcurrency);
}

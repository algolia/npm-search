import type { SearchClient, SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';

import type { StateManager } from './StateManager';
import * as algolia from './algolia';
import { config } from './config';
import * as npm from './npm';
import { Prefetcher } from './npm/Prefetcher';
import type { GetPackage } from './npm/types';
import { saveDoc } from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';
import { wait } from './utils/wait';

let prefetcher: Prefetcher;

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
async function run(
  stateManager: StateManager,
  algoliaClient: SearchClient,
  mainIndex: SearchIndex,
  bootstrapIndex: SearchIndex
): Promise<void> {
  const state = await stateManager.check();

  if (state.seq && state.seq > 0 && state.bootstrapDone === true) {
    await algolia.putDefaultSettings(mainIndex, config);
    log.info('⛷   Bootstrap: done');
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
  log.info(`Total packages   ${totalDocs}`);
  log.info('-----');

  prefetcher = new Prefetcher({
    nextKey: state.bootstrapLastId,
  });
  prefetcher.launch();

  let done = 0;
  const consumer = createPkgConsumer(stateManager, bootstrapIndex);
  consumer.unsaturated(async () => {
    const next = await prefetcher.getNext();
    consumer.push(next);
    done += 1;
  });

  let processing = true;
  while (processing) {
    await wait(5000);

    processing = prefetcher.isFinished;
    logProgress(prefetcher.offset, done);
    done = 0;
  }

  log.info('-----');
  log.info('⛷   Bootstrap: done');
  await stateManager.save({
    bootstrapDone: true,
    bootstrapLastDone: Date.now(),
  });

  await moveToProduction(stateManager, algoliaClient);
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
  await algoliaClient.copyIndex(config.bootstrapIndexName, config.indexName);

  await stateManager.save(currentState);
}

/**
 * Log approximate progress.
 */
async function logProgress(offset: number, nbDocs: number): Promise<void> {
  const { nbDocs: totalDocs } = await npm.getInfo();

  log.info(
    `[progress] %d/%d docs (%d%) (%s remaining)`,
    offset + nbDocs,
    totalDocs,
    Math.floor((Math.max(offset + nbDocs, 1) / totalDocs) * 100)
  );
}

/**
 * Consume packages.
 */
function createPkgConsumer(
  stateManager: StateManager,
  index: SearchIndex
): QueueObject<GetPackage> {
  return queue<GetPackage>(async (pkg) => {
    log.info(`Processing:`, pkg.name);
    const start = Date.now();

    try {
      datadog.increment('packages');

      const res = await npm.getDoc(pkg.name);

      await saveDoc({ row: res, index });

      // Because of concurrency we can have processed a package after in the list but sooner in the process.
      if ((await stateManager.get())!.bootstrapLastId! < pkg.name) {
        await stateManager.save({
          bootstrapLastId: pkg.name,
        });
      }
      log.info(`Saved`, pkg.name);
    } catch (err) {
      sentry.report(err);
    } finally {
      datadog.timing('loop', Date.now() - start);
    }
  }, 20);
}

export { run };

import { EventEmitter } from 'events';

import type { SearchClient, SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';
import chalk from 'chalk';

import type { StateManager } from './StateManager';
import { putDefaultSettings } from './algolia';
import { config } from './config';
import { formatPkg } from './formatPkg';
import * as npm from './npm';
import type { PrefetchedPkg } from './npm/Prefetcher';
import { Prefetcher } from './npm/Prefetcher';
import { isFailure } from './npm/types';
import { saveDoc } from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';
import { backoff } from './utils/wait';

type PkgJob = {
  pkg: PrefetchedPkg;
  retry: number;
};

export class Bootstrap extends EventEmitter {
  stateManager: StateManager;
  algoliaClient: SearchClient;
  mainIndex: SearchIndex;
  bootstrapIndex: SearchIndex;
  prefetcher: Prefetcher | undefined;
  consumer: QueueObject<PkgJob> | undefined;
  interval: NodeJS.Timer | undefined;

  constructor(
    stateManager: StateManager,
    algoliaClient: SearchClient,
    mainIndex: SearchIndex,
    bootstrapIndex: SearchIndex
  ) {
    super();
    this.stateManager = stateManager;
    this.algoliaClient = algoliaClient;
    this.mainIndex = mainIndex;
    this.bootstrapIndex = bootstrapIndex;
  }

  override on(param: 'finished', cb: () => any): this;
  override on(param: string, cb: () => void): this {
    return super.on(param, cb);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.consumer) {
      this.consumer.kill();
      await this.consumer.drain();
    }

    if (this.prefetcher) {
      this.prefetcher.stop();
    }

    log.info('Stopped Bootstrap gracefully', {
      queued: this.consumer?.length(),
      processing: this.consumer?.running(),
    });
  }

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
  async run(): Promise<void> {
    log.info('-----');
    log.info('⛷   Bootstrap: starting');
    const state = await this.stateManager.check();

    await this.stateManager.save({
      stage: 'bootstrap',
    });

    const { seq, nbDocs: totalDocs } = await npm.getInfo();
    if (!state.bootstrapLastId) {
      // Start from 0
      log.info('⛷   Bootstrap: starting from the first doc');
      // first time this launches, we need to remember the last seq our bootstrap can trust
      await this.stateManager.save({ seq });
      await putDefaultSettings(this.bootstrapIndex, config);
    } else {
      log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
    }

    log.info('-----');
    log.info(chalk.yellowBright`Total packages: ${totalDocs}`);
    log.info('-----');

    const prefetcher = new Prefetcher({
      nextKey: state.bootstrapLastId,
    });
    prefetcher.launch();

    let done = 0;
    const consumer = createPkgConsumer(this.stateManager, this.bootstrapIndex);
    consumer.unsaturated(async () => {
      const next = await prefetcher.getNext();
      consumer.push({ pkg: next, retry: 0 });
      done += 1;
    });
    consumer.buffer = 0;

    this.prefetcher = prefetcher;
    this.consumer = consumer;

    this.interval = setInterval(async () => {
      this.logProgress(done);

      if (prefetcher.isFinished) {
        clearInterval(this.interval!);
        await this.afterProcessing();
        return;
      }
      done = 0;

      // Push nothing to trigger event
      this.consumer!.push(null as any);
    }, config.prefetchWaitBetweenPage);
  }

  /**
   * Tell if we need to execute bootstrap or not.
   */
  async isDone(): Promise<boolean> {
    const state = await this.stateManager.check();

    if (state.seq && state.seq > 0 && state.bootstrapDone === true) {
      await putDefaultSettings(this.mainIndex, config);
      log.info('⛷   Bootstrap: already done, skipping');

      return true;
    }

    return false;
  }

  /**
   * Last step after everything has been processed.
   */
  private async afterProcessing(): Promise<void> {
    // While we no longer are in "processing" mode
    //  it can be possible that there's a last iteration in the queue
    await this.consumer!.drain();
    this.consumer!.kill();

    await this.stateManager.save({
      bootstrapDone: true,
      bootstrapLastDone: Date.now(),
    });

    await this.moveToProduction();

    log.info('-----');
    log.info('⛷   Bootstrap: done');
    log.info('-----');

    this.emit('finished');
  }

  /**
   * Move algolia index to prod.
   */
  private async moveToProduction(): Promise<void> {
    log.info('🚚  starting move to production');

    const currentState = await this.stateManager.get();
    await this.algoliaClient
      .copyIndex(
        config.indexName,
        `${config.indexName}.bak-${new Date()
          .toLocaleDateString()
          .replaceAll('/', '_')}`
      )
      .wait();
    await this.algoliaClient
      .copyIndex(config.bootstrapIndexName, config.indexName)
      .wait();

    await this.stateManager.save(currentState);
  }

  /**
   * Log approximate progress.
   */
  private async logProgress(nbDocs: number): Promise<void> {
    const { nbDocs: totalDocs } = await npm.getInfo();
    const offset = this.prefetcher!.offset;

    log.info(
      chalk.dim.italic
        .white`[progress] %d/%d docs (%s%) (%s prefetched) (%s processing; %s buffer)`,
      offset + nbDocs,
      totalDocs,
      ((Math.max(offset + nbDocs, 1) / totalDocs) * 100).toFixed(2),
      this.prefetcher!.idleCount,
      this.consumer!.running(),
      this.consumer!.length()
    );
  }
}

/**
 * Consume packages.
 */
function createPkgConsumer(
  stateManager: StateManager,
  index: SearchIndex
): QueueObject<PkgJob> {
  const consumer = queue<PkgJob>(async ({ pkg, retry }) => {
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

      const formatted = formatPkg(res);
      if (!formatted) {
        return;
      }
      await saveDoc({ formatted, index });

      const lastId = (await stateManager.get()).bootstrapLastId;

      // Because of concurrency we can have processed a package after in the list but sooner in the process.
      if (!lastId || lastId < pkg.id) {
        await stateManager.save({
          bootstrapLastId: pkg.id,
        });
      }
      log.info(`Done:`, pkg.id);
    } catch (err) {
      log.info(`Failed:`, pkg.id);

      if (err instanceof Error && err.message.includes('Access denied')) {
        await backoff(retry + 1, config.retryBackoffPow);
        consumer.push({ pkg, retry: retry + 1 });
        sentry.report(new Error('Throttling job'), { err });
        return;
      }

      sentry.report(new Error('Error during job'), { err });
    } finally {
      datadog.timing('loop', Date.now() - start);
    }
  }, config.bootstrapConcurrency);

  return consumer;
}

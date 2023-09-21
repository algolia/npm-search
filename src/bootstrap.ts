import { EventEmitter } from 'events';

import chalk from 'chalk';

import type { StateManager } from './StateManager';
import type { AlgoliaStore } from './algolia';
import { putDefaultSettings } from './algolia';
import { config } from './config';
import { MainBootstrapIndexer } from './indexers/MainBootstrapIndexer';
import { OneTimeBackgroundIndexer } from './indexers/OneTimeBackgroundIndexer';
import { PeriodicBackgroundIndexer } from './indexers/PeriodicBackgroundIndexer';
import * as npm from './npm';
import { Prefetcher } from './npm/Prefetcher';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';

export class Bootstrap extends EventEmitter {
  stateManager: StateManager;
  algoliaStore: AlgoliaStore;
  prefetcher: Prefetcher | undefined;
  interval: NodeJS.Timer | undefined;
  oneTimeIndexer: OneTimeBackgroundIndexer | undefined;
  periodicDataIndexer: PeriodicBackgroundIndexer | undefined;
  mainBootstrapIndexer: MainBootstrapIndexer | undefined;

  constructor(stateManager: StateManager, algoliaStore: AlgoliaStore) {
    super();
    this.stateManager = stateManager;
    this.algoliaStore = algoliaStore;
  }

  override on(param: 'finished', cb: () => any): this;
  override on(param: string, cb: () => void): this {
    return super.on(param, cb);
  }

  async stop(): Promise<void> {
    log.info('Stopping Bootstrap...');

    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.prefetcher) {
      this.prefetcher.stop();
    }

    await this.oneTimeIndexer!.stop();
    await this.periodicDataIndexer!.stop();
    await this.mainBootstrapIndexer!.stop();

    log.info('Stopped Bootstrap gracefully');
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
      await putDefaultSettings(this.algoliaStore.bootstrapIndex, config);
    } else {
      log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
    }

    log.info('-----');
    log.info(chalk.yellowBright`Total packages: ${totalDocs}`);
    log.info('-----');

    this.prefetcher = new Prefetcher(
      this.stateManager,
      this.algoliaStore.bootstrapQueueIndex,
      {
        nextKey: state.bootstrapLastId,
      }
    );

    this.oneTimeIndexer = new OneTimeBackgroundIndexer(
      this.algoliaStore,
      this.algoliaStore.bootstrapIndex,
      this.algoliaStore.oneTimeDataIndex
    );

    this.periodicDataIndexer = new PeriodicBackgroundIndexer(
      this.algoliaStore,
      this.algoliaStore.bootstrapIndex,
      this.algoliaStore.periodicDataIndex,
      this.algoliaStore.bootstrapNotFoundIndex
    );

    this.mainBootstrapIndexer = new MainBootstrapIndexer(this.algoliaStore);

    this.prefetcher.run();
    this.oneTimeIndexer.run();
    this.periodicDataIndexer.run();
    this.mainBootstrapIndexer.run();

    let done = 0;

    this.interval = setInterval(async () => {
      this.logProgress(done).catch(() => {});

      try {
        if (
          this.prefetcher!.isFinished &&
          (await this.mainBootstrapIndexer!.isFinished())
        ) {
          clearInterval(this.interval!);
          await this.afterProcessing();
          return;
        }
      } catch (e) {
        sentry.report(e);
      }

      done = 0;
    }, config.prefetchWaitBetweenPage);
  }

  /**
   * Tell if we need to execute bootstrap or not.
   */
  async isDone(): Promise<boolean> {
    const state = await this.stateManager.check();

    if (state.seq && state.seq > 0 && state.bootstrapDone === true) {
      await putDefaultSettings(this.algoliaStore.mainIndex, config);
      log.info('⛷   Bootstrap: already done, skipping');

      return true;
    }

    return false;
  }

  /**
   * Last step after everything has been processed.
   */
  private async afterProcessing(): Promise<void> {
    await this.oneTimeIndexer!.stop();
    await this.periodicDataIndexer!.stop();
    await this.mainBootstrapIndexer!.stop();

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
    // Backup current prod index
    await this.algoliaStore.client
      .copyIndex(
        config.indexName,
        `${config.indexName}.bak-${new Date().toISOString()}`
      )
      .wait();

    // Replace prod with bootstrap
    await this.algoliaStore.client
      .copyIndex(config.bootstrapIndexName, config.indexName)
      .wait();

    // Remove bootstrap so we don't end up reusing a partial index
    await this.algoliaStore.bootstrapIndex.delete();

    await this.stateManager.save(currentState);
  }

  /**
   * Log approximate progress.
   */
  private async logProgress(nbDocs: number): Promise<void> {
    const { nbDocs: totalDocs } = await npm.getInfo();
    const queueLength = await this.mainBootstrapIndexer!.fetchQueueLength();
    const offset = this.prefetcher!.offset;

    datadog.gauge('sequence.total', totalDocs);
    datadog.gauge('sequence.current', offset + nbDocs);

    log.info(
      chalk.dim.italic
        .white`[progress] %d/%d docs queued (%s%) (%s in queue) (%s processing; %s buffer)`,
      offset + nbDocs,
      totalDocs,
      ((Math.max(offset + nbDocs, 1) / totalDocs) * 100).toFixed(2),
      queueLength,
      this.mainBootstrapIndexer!.running,
      this.mainBootstrapIndexer!.queued
    );

    datadog.gauge('job.idleCount', queueLength);
  }
}

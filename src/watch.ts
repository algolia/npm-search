import chalk from 'chalk';
import type { DatabaseChangesResultItem } from 'nano';

import type { StateManager } from './StateManager';
import type { AlgoliaStore } from './algolia';
import { config } from './config';
import { MainWatchIndexer } from './indexers/MainWatchIndexer';
import { OneTimeBackgroundIndexer } from './indexers/OneTimeBackgroundIndexer';
import { PeriodicBackgroundIndexer } from './indexers/PeriodicBackgroundIndexer';
import * as npm from './npm';
import { ChangesReader } from './npm/ChangesReader';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';
import { report } from './utils/sentry';
import { backoff } from './utils/wait';

export class Watch {
  stateManager: StateManager;
  algoliaStore: AlgoliaStore;
  // Cached npmInfo.seq
  totalSequence: number = 0;

  changesReader: ChangesReader | undefined;
  oneTimeIndexer: OneTimeBackgroundIndexer | undefined;
  periodicDataIndexer: PeriodicBackgroundIndexer | undefined;
  mainWatchIndexer: MainWatchIndexer | undefined;

  constructor(stateManager: StateManager, algoliaStore: AlgoliaStore) {
    this.stateManager = stateManager;
    this.algoliaStore = algoliaStore;
  }

  /**
   * Run watch.
   *
   *  --- Watch ?
   *   Watch is "Long Polled. This mode is not paginated and the event system in CouchDB send
   *     events as they arrive, which is super cool and reactive.
   *   One gotcha those events arrive at the same rate whether you are watching the last seq or not.
   *
   *   Example:
   *    listener A - up to date
   *    listener B - few sequences behind.
   *
   *    Package C is updated.
   *
   *    Listener A receive update C
   *    listener B receive update N.
   *
   *    Listener A is up to date again
   *    listener B is still few sequences behind and will not receive any other event
   *      until an other package is updated.
   *      It will never be up to date because he receive event at the same pace
   *      as they arrive in listener A, even if it's not the same package.
   */
  async run(): Promise<void> {
    log.info('-----');
    log.info('🚀  Watch: starting');
    log.info('-----');

    await this.stateManager.save({
      stage: 'watch',
    });

    setInterval(() => {
      npm.db
        .info()
        .then((info) => {
          this.totalSequence = Number(info.update_seq);
        })
        .catch(() => {});
    }, 5000).unref();

    this.oneTimeIndexer = new OneTimeBackgroundIndexer(
      this.algoliaStore,
      this.algoliaStore.mainIndex
    );

    this.periodicDataIndexer = new PeriodicBackgroundIndexer(
      this.algoliaStore,
      this.algoliaStore.mainIndex,
      this.algoliaStore.mainNotFoundIndex
    );

    this.mainWatchIndexer = new MainWatchIndexer(this.algoliaStore);

    this.oneTimeIndexer.run();
    this.periodicDataIndexer.run();
    this.mainWatchIndexer.run();

    await this.launchChangeReader();
  }

  async stop(): Promise<void> {
    log.info('Stopping Watch...');

    try {
      this.changesReader?.stop?.();
      await this.oneTimeIndexer?.stop?.();
      await this.periodicDataIndexer?.stop?.();
      await this.mainWatchIndexer?.stop?.();
    } catch (err) {
      sentry.report(err);
    }

    log.info('Stopped Watch gracefully');
  }

  async launchChangeReader(): Promise<void> {
    const { seq: since } = await this.stateManager.get();

    log.info(`listening from ${since}...`);

    const reader = new ChangesReader({ since: String(since) });

    reader
      .on('batch', (batch: DatabaseChangesResultItem[]) => {
        const changes = Array.from(
          batch
            .filter((change) => change.id)
            .reduce((acc, change) => {
              return acc.set(change.id, change);
            }, new Map())
            .values()
        );

        if (!changes.length) {
          return;
        }

        const storeChanges = async (retry = 0): Promise<void> => {
          try {
            await this.algoliaStore.mainQueueIndex.saveObjects(
              changes.map((change) => ({
                seq: change.seq,
                name: change.id,
                objectID: change.id,
                retries: 0,
                change,
              }))
            );
          } catch (err) {
            const newRetry = retry + 1;
            log.error('Error adding a change to the queue.', { err });

            await backoff(
              newRetry,
              config.retryBackoffPow,
              config.retryBackoffMax
            );

            return storeChanges(newRetry);
          }
        };

        // We need to move one at a time here, so pause until the change is safely stored.
        reader.pause();

        storeChanges().then(() => {
          const seq = changes.at(-1).seq;

          reader.resume();
          this.logProgress(seq).catch(() => {});

          this.stateManager.save({ seq }).catch((err) => {
            report(new Error('Error storing watch progress'), { err });
          });
        });
      })
      .on('error', (err) => {
        sentry.report(err);
      })
      .run();

    this.changesReader = reader;
  }

  /**
   * Log our process through watch.
   *
   */
  async logProgress(seq: number): Promise<void> {
    const queueLength = await this.mainWatchIndexer!.fetchQueueLength();

    datadog.gauge('sequence.total', this.totalSequence);
    datadog.gauge('sequence.current', seq);
    datadog.gauge('job.idleCount', queueLength);

    log.info(
      chalk.dim.italic
        .white`[progress] Synced %d/%d changes (%s%) (%s remaining) (~%s in queue)`,
      seq,
      this.totalSequence,
      ((Math.max(seq, 1) / this.totalSequence) * 100).toFixed(2),
      this.totalSequence - seq,
      queueLength
    );
  }
}

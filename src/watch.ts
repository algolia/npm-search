/* eslint-disable consistent-return */
import type { SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';
import chalk from 'chalk';
import type { DatabaseChangesResultItem } from 'nano';

import type { StateManager } from './StateManager';
import * as npm from './npm';
import { isFailure } from './npm/types';
import { saveDoc } from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';

export class Watch {
  stateManager: StateManager;
  mainIndex: SearchIndex;
  // Cached npmInfo.seq
  totalSequence: number = 0;
  changesConsumer: QueueObject<DatabaseChangesResultItem> | undefined;

  constructor(stateManager: StateManager, mainIndex: SearchIndex) {
    this.stateManager = stateManager;
    this.mainIndex = mainIndex;
  }

  /**
   * Run watch.
   *
   *  --- Watch ?
   *   Watch is "Long Polled. This mode is not paginated and the event system in CouchDB send
   *     events as they arrive, which is super cool and reactive.
   *   One gotcha those events arrive at the same rate wether you are watching the last seq or not.
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

    this.changesConsumer = this.createChangeConsumer();

    setInterval(async () => {
      this.totalSequence = (await npm.db.info()).update_seq;
    }, 5000);

    await this.watch();

    log.info('-----');
    log.info('🚀  Watch: done');
    log.info('-----');
  }

  /**
   * Active synchronous mode with Registry.
   * Changes are polled with a keep-alived connection.
   *
   * @param stateManager - The state manager.
   * @param mainIndex - Algolia index manager.
   */
  async watch(): Promise<boolean | undefined> {
    const { seq } = await this.stateManager.get();
    const changesConsumer = this.changesConsumer;
    if (!changesConsumer) {
      log.warn('Can not watch without a consumer');
      return;
    }

    const listener = npm.db.changesReader
      .start({
        includeDocs: false,
        batchSize: 1,
        since: String(seq),
      })
      .on('change', (change) => {
        changesConsumer.push(change);

        // on:change will not wait for us to process to trigger again
        // So we need to control the fetch manually otherwise it will fetch thousand/millions of update in advance
        if (changesConsumer.length() > 10) {
          npm.db.changesReader.pause();
        }
      })
      .on('error', (err) => {
        sentry.report(err);
      });

    changesConsumer.saturated(() => {
      if (changesConsumer.length() < 5) {
        npm.db.changesReader.resume();
      }
    });

    return new Promise((resolve) => {
      listener.on('end', () => {
        resolve(true);
      });
    });
  }

  /**
   * Process changes in order.
   */
  async loop(change: DatabaseChangesResultItem): Promise<void> {
    datadog.increment('packages');

    if (!change.id) {
      // Can happen when NPM send an empty line (for example the hearthbeat) 🤷🏻‍
      log.error('Got a document without name', change);
      return;
    }

    try {
      if (change.deleted) {
        // Delete package directly in index
        // Filter does not support async/await but there is no concurrency issue with this
        throw new Error('deleted');
      }
      const res = await npm.getDoc(change.id, change.changes[0].rev);

      if (isFailure(res)) {
        log.error('Got an error', res.error);
        return;
      }

      await saveDoc({ row: res, index: this.mainIndex });
    } catch (err) {
      // this error can be thrown by us or by nano if:
      // - we received a change that is not marked as "deleted"
      // - and the package has since been deleted
      if (err instanceof Error && err.message === 'deleted') {
        this.mainIndex.deleteObject(change.id);
        log.info(`deleted`, change.id);
      }
    }
  }

  /**
   * Log our process through watch.
   *
   */
  logProgress(seq: number): void {
    datadog.gauge('watch.sequence.total', this.totalSequence);
    datadog.gauge('watch.sequence.current', seq);

    log.info(
      chalk.dim.italic
        .white`[progress] Synced %d/%d changes (%s%) (%s remaining) (%s in memory)`,
      seq,
      this.totalSequence,
      ((Math.max(seq, 1) / this.totalSequence) * 100).toFixed(2),
      this.totalSequence - seq,
      this.changesConsumer!.length()
    );
  }

  /**
   * Queue is ensuring we are processing changes ordered
   * This also means we can not process more than 1 at the same time.
   *
   * --- Why ?
   *   CouchDB send changes in an ordered fashion
   *     Event A update package C
   *     Event B delete package C.
   *
   *     If the events are not processed in the same order, you can have a broken state.
   */
  createChangeConsumer(): QueueObject<DatabaseChangesResultItem> {
    return queue<DatabaseChangesResultItem>(async (change) => {
      const start = Date.now();

      const seq = change.seq;
      log.info(`Start:`, change.id);

      try {
        await this.loop(change);
        await this.stateManager.save({
          seq,
        });
      } catch (err) {
        sentry.report(err);
      } finally {
        log.info(`Done:`, change.id);
        this.logProgress(seq);
        datadog.timing('watch.loop', Date.now() - start);
      }
    }, 1);
  }
}

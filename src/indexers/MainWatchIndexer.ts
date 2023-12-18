import ms from 'ms';
import type { DatabaseChangesResultItem } from 'nano';

import type { AlgoliaStore } from '../algolia';
import { formatPkg } from '../formatPkg';
import * as npm from '../npm';
import { isFailure } from '../npm/types';
import { saveDoc } from '../saveDocs';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';

import { MainIndexer } from './MainIndexer';

type TaskType = {
  seq: number;
  name: string;
  objectID: string;
  retries: number;
  change: DatabaseChangesResultItem;
};

export class MainWatchIndexer extends MainIndexer<TaskType> {
  protected facetField = 'retries';
  protected cleanupInterval: NodeJS.Timer | undefined;

  override get facetFilter(): string {
    return 'NOT isProcessed:1';
  }

  constructor(algoliaStore: AlgoliaStore) {
    super(algoliaStore, algoliaStore.mainQueueIndex);
  }

  async markAsProcessed(objectID, seq): Promise<void> {
    await this.mainIndex
      .partialUpdateObject({
        objectID,
        isProcessed: 1,
        seq: { _operation: 'IncrementFrom', value: seq },
      })
      .wait()
      .catch(() => {});
  }

  async recordExecutor(record: TaskType): Promise<void> {
    await this.queueTask(record);
  }

  override run(): void {
    this.cleanupInterval = setInterval(() => {
      this.mainIndex
        .deleteBy({
          filters: 'isProcessed:1',
        })
        .catch((e) => sentry.report(e));
    }, ms('1 minute'));

    super.run();
  }

  override async stop(force: boolean = false): Promise<void> {
    clearInterval(this.cleanupInterval);
    return super.stop(force);
  }

  async taskExecutor({
    seq,
    objectID,
    retries,
    change,
  }: TaskType): Promise<void> {
    log.info(`Start:`, change.id, retries);
    const start = Date.now();

    try {
      datadog.increment('packages');

      if (change.deleted) {
        await this.algoliaStore.mainIndex.deleteObject(change.id);
      } else {
        if (change.changes.length <= 0) {
          log.error('Document without change');
          await this.markAsProcessed(objectID, seq);
          return;
        }

        const res = await npm.getDoc(change.id, change.changes[0]!.rev);

        if (isFailure(res)) {
          log.error('Got an error', res.error);
          await this.markAsProcessed(objectID, seq);
          return;
        }

        const formatted = formatPkg(res);

        if (!formatted) {
          await this.markAsProcessed(objectID, seq);
          return;
        }

        await saveDoc({
          formatted,
          index: this.algoliaStore.mainIndex,
          oneTimeDataIndex: this.algoliaStore.oneTimeDataIndex,
          periodicDataIndex: this.algoliaStore.periodicDataIndex,
        });
      }

      await this.markAsProcessed(objectID, seq);
      log.info(`Done:`, change.id, retries);
    } catch (err: any) {
      log.info(`Failed:`, change.id, retries, err.statusCode);

      if (err.statusCode === 404) {
        // Store in not-found index
        datadog.increment('job.notFound');

        await this.algoliaStore.mainNotFoundIndex
          .saveObject({
            name: change.id,
            objectID: change.id,
            err: err instanceof Error ? err.toString() : err,
            date: new Date().toISOString(),
            movedBy: 'watch',
          })
          .catch(() => {});

        await this.markAsProcessed(objectID, seq);
        return;
      }

      sentry.report(new Error('Error during job'), {
        statusCode: err.statusCode,
        err,
      });

      datadog.increment('job.retries');

      await this.mainIndex
        .partialUpdateObject({
          objectID,
          retries: retries + 1,
        })
        .wait()
        .catch(() => {});
    } finally {
      datadog.timing('loop', Date.now() - start);
    }
  }
}

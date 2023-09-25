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
  change: DatabaseChangesResultItem;
  objectID: string;
  retries: number;
};

export class MainWatchIndexer extends MainIndexer<TaskType> {
  protected facetField = 'retries';

  constructor(algoliaStore: AlgoliaStore) {
    super(algoliaStore, algoliaStore.mainQueueIndex);
  }

  async delete(objectID): Promise<void> {
    await this.mainIndex.deleteObject(objectID);
  }

  async recordExecutor(record: TaskType): Promise<void> {
    await this.queueTask(record);
  }

  async taskExecutor({ change, objectID, retries }: TaskType): Promise<void> {
    log.info(`Start:`, change.id, retries);
    const start = Date.now();

    try {
      datadog.increment('packages');

      if (change.deleted) {
        await this.algoliaStore.mainIndex.deleteObject(change.id).wait();
      } else {
        if (change.changes.length <= 0) {
          log.error('Document without change');
          return;
        }

        const res = await npm.getDoc(change.id, change.changes[0]!.rev);

        if (isFailure(res)) {
          log.error('Got an error', res.error);
          this.delete(objectID).catch(() => {});
          return;
        }

        const formatted = formatPkg(res);

        if (!formatted) {
          this.delete(objectID).catch(() => {});
          return;
        }

        await saveDoc({
          formatted,
          index: this.algoliaStore.mainIndex,
          oneTimeDataIndex: this.algoliaStore.oneTimeDataIndex,
          periodicDataIndex: this.algoliaStore.periodicDataIndex,
        });

        await this.delete(objectID);

        log.info(`Done:`, change.id, retries);
      }
    } catch (err: any) {
      log.info(`Failed:`, change.id, retries, err.statusCode);

      if (err.statusCode === 404) {
        // Store in not-found index
        datadog.increment('job.notFound');

        await this.algoliaStore.mainNotFoundIndex
          .saveObject({
            objectID: change.id,
            err: err instanceof Error ? err.toString() : err,
            date: new Date().toISOString(),
            movedBy: 'watch',
          })
          .catch(() => {});

        await this.delete(objectID).catch(() => {});
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
        .catch(() => {});
    } finally {
      datadog.timing('loop', Date.now() - start);
    }
  }
}

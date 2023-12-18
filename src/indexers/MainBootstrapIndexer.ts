import type { AlgoliaStore } from '../algolia';
import { formatPkg } from '../formatPkg';
import * as npm from '../npm';
import type { PrefetchedPkg } from '../npm/Prefetcher';
import { isFailure } from '../npm/types';
import { saveDoc } from '../saveDocs';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';

import { MainIndexer } from './MainIndexer';

type TaskType = { pkg: PrefetchedPkg; objectID: string; retries: number };

export class MainBootstrapIndexer extends MainIndexer<TaskType> {
  protected facetField = 'retries';

  constructor(algoliaStore: AlgoliaStore) {
    super(algoliaStore, algoliaStore.bootstrapQueueIndex);
  }

  override async isFinished(): Promise<boolean> {
    if (!(await super.isFinished())) {
      return false;
    }

    return (await this.fetchQueueLength()) === 0;
  }

  async markAsProcessed(objectID): Promise<void> {
    await this.mainIndex
      .deleteObject(objectID)
      .wait()
      .catch(() => {});
  }

  async recordExecutor(record: TaskType): Promise<void> {
    await this.queueTask(record);
  }

  async taskExecutor({ pkg, objectID, retries }): Promise<void> {
    log.info(`Start:`, pkg.id, retries);
    const start = Date.now();

    try {
      datadog.increment('packages');

      const res = await npm.getDoc(pkg.id, pkg.value.rev);

      if (isFailure(res)) {
        log.error('Got an error', res.error);
        await this.markAsProcessed(objectID);
        return;
      }

      const formatted = formatPkg(res);

      if (!formatted) {
        log.error('Empty formatted output', pkg);
        await this.markAsProcessed(objectID);
        return;
      }

      await saveDoc({
        formatted,
        index: this.algoliaStore.bootstrapIndex,
        oneTimeDataIndex: this.algoliaStore.oneTimeDataIndex,
        periodicDataIndex: this.algoliaStore.periodicDataIndex,
      });

      await this.markAsProcessed(objectID);
      log.info(`Done:`, pkg.id, retries);
    } catch (err: any) {
      log.info(`Failed:`, pkg.id, retries, err.statusCode);

      if (err.statusCode === 404) {
        // Store in not-found index
        datadog.increment('job.notFound');

        await this.algoliaStore.bootstrapNotFoundIndex
          .saveObject({
            name: pkg.id,
            objectID: pkg.id,
            err: err instanceof Error ? err.toString() : err,
            date: new Date().toISOString(),
            movedBy: 'bootstrap',
          })
          .catch(() => {});

        await this.markAsProcessed(objectID);
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

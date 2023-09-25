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

  async delete(objectID): Promise<void> {
    await this.mainIndex.deleteObject(objectID).wait();
  }

  override async isFinished(): Promise<boolean> {
    if (!(await super.isFinished())) {
      return false;
    }

    return (await this.fetchQueueLength()) === 0;
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
        this.delete(objectID).catch(() => {});
        return;
      }

      const formatted = formatPkg(res);

      if (!formatted) {
        log.error('Empty formatted output', pkg);
        this.delete(objectID).catch(() => {});
        return;
      }

      await saveDoc({
        formatted,
        index: this.algoliaStore.bootstrapIndex,
        oneTimeDataIndex: this.algoliaStore.oneTimeDataIndex,
        periodicDataIndex: this.algoliaStore.periodicDataIndex,
      });

      await this.delete(objectID);

      log.info(`Done:`, pkg.id, retries);
    } catch (err: any) {
      log.info(`Failed:`, pkg.id, retries, err.statusCode);

      if (err.statusCode === 404) {
        // Store in not-found index
        datadog.increment('job.notFound');

        await this.algoliaStore.bootstrapNotFoundIndex
          .saveObject({
            objectID: pkg.id,
            err: err instanceof Error ? err.toString() : err,
            date: new Date().toISOString(),
            movedBy: 'bootstrap',
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

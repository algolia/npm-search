import ms from 'ms';
import type { DatabaseChangesResultItem } from 'nano';

import type { AlgoliaStore } from '../algolia';
import { PackageNotFoundError } from '../errors';
import { formatPkg } from '../formatPkg';
import * as npm from '../npm';
import type { GetPackage } from '../npm/types';
import { saveDoc } from '../saveDocs';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';

import { MainIndexer } from './MainIndexer';

const MAX_REGISTRY_FAILURES = 6;

type TaskType = {
  seq: number;
  name: string;
  objectID: string;
  retries: number;
  nextAttemptAt: number;
  queueVersion: number;
  registryFailures?: number;
  registryError?: string;
  registryNotFound?: boolean;
  change: DatabaseChangesResultItem;
};

export class MainWatchIndexer extends MainIndexer<TaskType> {
  protected facetField = 'retries';
  protected cleanupInterval: NodeJS.Timer | undefined;

  override get facetFilter(): string {
    return `NOT isProcessed:1 AND nextAttemptAt <= ${Date.now()}`;
  }

  constructor(algoliaStore: AlgoliaStore) {
    super(algoliaStore, algoliaStore.mainQueueIndex);
  }

  async markAsProcessed(objectID: string, queueVersion: number): Promise<void> {
    await this.mainIndex
      .partialUpdateObject(
        {
          objectID,
          isProcessed: 1,
          queueVersion: { _operation: 'IncrementFrom', value: queueVersion },
        },
        { createIfNotExists: false }
      )
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

  async taskExecutor(task: TaskType): Promise<void> {
    const { queueVersion, objectID, retries, change } = task;
    log.info(`Start:`, change.id, retries);
    const start = Date.now();

    try {
      if ((task.registryFailures || 0) >= MAX_REGISTRY_FAILURES) {
        await this.scheduleRetry(task);
        return;
      }

      datadog.increment('packages');

      if (change.deleted) {
        await this.algoliaStore.mainIndex.deleteObject(change.id);
      } else {
        if (change.changes.length <= 0) {
          log.error('Document without change');
          await this.markAsProcessed(objectID, queueVersion);
          return;
        }

        let res: GetPackage;

        try {
          res = await npm.getDocFromRegistry(change.id);
        } catch (error) {
          if (error instanceof PackageNotFoundError) {
            log.warn('Package not found in the registry', error);
          } else {
            log.error('Got an error', error);
          }

          await this.scheduleRetry(task, error);
          return;
        }

        const formatted = formatPkg(res);

        if (!formatted) {
          await this.markAsProcessed(objectID, queueVersion);
          return;
        }

        await saveDoc({
          formatted,
          index: this.algoliaStore.mainIndex,
          oneTimeDataIndex: this.algoliaStore.oneTimeDataIndex,
          periodicDataIndex: this.algoliaStore.periodicDataIndex,
        });
      }

      await this.markAsProcessed(objectID, queueVersion);
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

        await this.markAsProcessed(objectID, queueVersion);
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

  private async scheduleRetry(task: TaskType, error?: unknown): Promise<void> {
    let diagnostic = task;

    if ((task.registryFailures || 0) < MAX_REGISTRY_FAILURES) {
      const registryFailures = (task.registryFailures || 0) + 1;

      diagnostic = {
        ...task,
        queueVersion: task.queueVersion + 1,
        registryFailures,
        registryError:
          error instanceof Error ? error.toString() : String(error),
        registryNotFound: error instanceof PackageNotFoundError,
      };

      // Persist exhaustion before logging, so a logging failure cannot grant
      // another registry fetch. The guard rejects writes from replaced jobs.
      await this.mainIndex
        .partialUpdateObject(
          {
            objectID: task.objectID,
            queueVersion: {
              _operation: 'IncrementFrom',
              value: task.queueVersion,
            },
            registryFailures,
            registryError: diagnostic.registryError,
            registryNotFound: diagnostic.registryNotFound,
            ...(registryFailures < MAX_REGISTRY_FAILURES
              ? {
                  nextAttemptAt:
                    Date.now() + ms('1 hour') * 2 ** (registryFailures - 1),
                }
              : {}),
          },
          { createIfNotExists: false }
        )
        .wait();

      if (registryFailures < MAX_REGISTRY_FAILURES) {
        datadog.increment('job.registryRetries');
        return;
      }
    }

    await this.algoliaStore.mainNotFoundIndex.saveObject({
      objectID: task.objectID,
      name: task.objectID,
      err: diagnostic.registryError,
      date: new Date().toISOString(),
      movedBy: 'watch',
      reason: diagnostic.registryNotFound ? 'not-found' : 'registry',
      registryFailures: diagnostic.registryFailures,
    });

    datadog.increment('job.registryExhausted');
    await this.markAsProcessed(task.objectID, diagnostic.queueVersion);
  }
}

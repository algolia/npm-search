import type { SearchIndex } from 'algoliasearch';
import Bluebird from 'bluebird';
import ms from 'ms';

import type { FinalPkg } from '../@types/pkg';
import type { AlgoliaStore } from '../algolia';
import { PackageNotFoundError } from '../errors';
import * as jsDelivr from '../jsDelivr';
import type { DownloadsData } from '../npm';
import { computeDownload, getDocFromRegistry, getDownloads } from '../npm';
import { getPopularAlternativeNames } from '../saveDocs';
import { datadog } from '../utils/datadog';
import * as sentry from '../utils/sentry';
import { offsetToTimestamp, round } from '../utils/time';

import { Indexer } from './Indexer';

export type PeriodicDataObject = DownloadsData & {
  name: string;
  objectID: string;
  updatedAt: string;
};

type Task = { pkg: FinalPkg[] };

export class PeriodicBackgroundIndexer extends Indexer<FinalPkg, Task> {
  protected readonly facetField: string = '_periodicDataUpdatedAt';
  private packagesPerBatch: number = 127;
  private unscopedPackages: FinalPkg[];
  private notFoundIndex: SearchIndex;

  override get facetFilter(): string {
    const expired = offsetToTimestamp(-ms('30 days'));
    return `${this.facetField} < ${expired}`;
  }

  constructor(
    algoliaStore: AlgoliaStore,
    mainIndex: SearchIndex,
    notFoundIndex: SearchIndex
  ) {
    super(algoliaStore, mainIndex);

    this.notFoundIndex = notFoundIndex;
    this.unscopedPackages = [];
  }

  override async flush(): Promise<void> {
    while (this.unscopedPackages.length) {
      await this.queueTask({
        pkg: this.unscopedPackages.splice(0, this.packagesPerBatch),
      });
    }

    return super.flush();
  }

  async recordExecutor(pkg: FinalPkg): Promise<void> {
    if (pkg.objectID.startsWith('@')) {
      await this.queueTask({ pkg: [pkg] });
      return;
    }

    if (!this.unscopedPackages.find((p) => p.name === pkg.name)) {
      this.unscopedPackages.push(pkg);
    }

    if (this.unscopedPackages.length >= this.packagesPerBatch) {
      await this.queueTask({
        pkg: this.unscopedPackages.splice(0, this.packagesPerBatch),
      });
    }
  }

  override async stop(): Promise<void> {
    return super.stop(true);
  }

  async taskExecutor(task: Task): Promise<void> {
    try {
      const downloads = await getDownloads(task.pkg);
      const oneWeekAgo = offsetToTimestamp(-ms('1 week'));
      const dataIndexObjects: PeriodicDataObject[] = [];
      const patches: Array<Partial<FinalPkg>> = [];

      await Bluebird.map(
        task.pkg,
        async (pkg) => {
          const data: PeriodicDataObject = {
            name: pkg.name,
            objectID: pkg.name,
            updatedAt: new Date().toISOString(),
            totalNpmDownloads: downloads[pkg.name]?.totalNpmDownloads,
            packageNpmDownloads: downloads[pkg.name]?.packageNpmDownloads,
          };

          dataIndexObjects.push(data);

          // The npm replicate API often incorrectly reports packages there were
          // actually deleted from the registry. If the downloads API has no
          // records for the package, and the package was published more than
          // a while ago, we check with the registry. If the registry says the
          // package does not exist, we delete it.
          if (
            data.packageNpmDownloads === undefined &&
            pkg.created < oneWeekAgo
          ) {
            try {
              await getDocFromRegistry(pkg.name);
            } catch (e) {
              if (e instanceof PackageNotFoundError) {
                datadog.increment('periodic.notFound');

                await this.notFoundIndex.saveObject({
                  name: pkg.name,
                  objectID: pkg.name,
                  date: new Date().toISOString(),
                  movedBy: 'periodicIndexer',
                });

                await this.algoliaStore.periodicDataIndex.deleteObject(
                  pkg.name
                );

                await this.mainIndex.deleteObject(pkg.name).wait();
                return;
              }
            }
          }

          const npmDownloads = computeDownload(
            pkg,
            data.packageNpmDownloads,
            data.totalNpmDownloads
          );

          const jsDelivrHits = jsDelivr.getHit(pkg);
          const pkgPatch = {
            objectID: pkg.objectID,
            ...(npmDownloads || {}),
            ...jsDelivrHits,
            popular: npmDownloads?.popular || jsDelivrHits.popular,
          };

          patches.push({
            ...pkgPatch,
            _searchInternal: {
              ...pkg._searchInternal,
              popularAlternativeNames: getPopularAlternativeNames({
                ...pkg,
                ...pkgPatch,
              }),
            },
            [this.facetField]: round(new Date(data.updatedAt)).valueOf(),
          });
        },
        { concurrency: 20 }
      );

      await Promise.all([
        this.algoliaStore.periodicDataIndex.saveObjects(dataIndexObjects),
        this.mainIndex.partialUpdateObjects(patches).wait(),
      ]);

      datadog.increment('periodicDataIndex.success', task.pkg.length);
    } catch (err) {
      datadog.increment('periodicDataIndex.failure', task.pkg.length);
      sentry.report(new Error(`Error in ${this.constructor.name}`), { err });

      await this.mainIndex
        .partialUpdateObjects(
          task.pkg.map((pkg) => {
            return {
              objectID: pkg.objectID,
              [this.facetField]: offsetToTimestamp(
                ms('1 day'),
                new Date(pkg[this.facetField])
              ),
            };
          })
        )
        .wait()
        .catch(() => {});
    }
  }
}

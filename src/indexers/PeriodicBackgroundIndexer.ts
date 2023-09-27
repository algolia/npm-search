import type { SearchIndex } from 'algoliasearch';
import { mapLimit } from 'async';
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
  objectID: string;
  updatedAt: string;
};

type Task = { pkg: FinalPkg[] };

export class PeriodicBackgroundIndexer extends Indexer<FinalPkg, Task> {
  protected readonly facetField: string = '_periodicDataUpdatedAt';
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

  async recordExecutor(pkg: FinalPkg): Promise<void> {
    const packagesPerBatch = 127;

    if (pkg.objectID.startsWith('@')) {
      await this.queueTask({ pkg: [pkg] });
      return;
    }

    if (!this.unscopedPackages.find((p) => p.name === pkg.name)) {
      this.unscopedPackages.push(pkg);
    }

    if (this.unscopedPackages.length >= packagesPerBatch) {
      await this.queueTask({
        pkg: this.unscopedPackages.splice(0, packagesPerBatch),
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

      await mapLimit(task.pkg, 20, async (pkg) => {
        const data: PeriodicDataObject = {
          objectID: pkg.name,
          updatedAt: new Date().toISOString(),
          totalNpmDownloads: downloads[pkg.name]?.totalNpmDownloads,
          packageNpmDownloads: downloads[pkg.name]?.packageNpmDownloads,
        };

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
                objectID: pkg.name,
                date: new Date().toISOString(),
                movedBy: 'periodicIndexer',
              });

              await this.algoliaStore.periodicDataIndex
                .deleteObject(pkg.name)
                .wait();

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

        await Promise.all([
          this.algoliaStore.periodicDataIndex.saveObject(data),
          this.mainIndex.partialUpdateObject(
            {
              ...pkgPatch,
              _searchInternal: {
                ...pkg._searchInternal,
                popularAlternativeNames: getPopularAlternativeNames({
                  ...pkg,
                  ...pkgPatch,
                }),
              },
              [this.facetField]: round(new Date(data.updatedAt)).valueOf(),
            },
            { createIfNotExists: false }
          ),
        ]);
      });

      datadog.increment('periodicDataIndex.success', task.pkg.length);
    } catch (err) {
      datadog.increment('periodicDataIndex.failure', task.pkg.length);
      sentry.report(new Error(`Error in ${this.constructor.name}`), { err });

      await mapLimit(task.pkg, 20, (pkg) => {
        return this.mainIndex.partialUpdateObject(
          {
            objectID: pkg.objectID,
            [this.facetField]: offsetToTimestamp(
              ms('1 day'),
              new Date(pkg[this.facetField])
            ),
          },
          { createIfNotExists: false }
        );
      }).catch(() => {});
    }
  }
}

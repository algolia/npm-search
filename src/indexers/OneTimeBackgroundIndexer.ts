import ms from 'ms';

import type { FinalPkg } from '../@types/pkg';
import { getChangelogBackground } from '../changelog';
import { getFileListMetadata } from '../saveDocs';
import { datadog } from '../utils/datadog';
import * as sentry from '../utils/sentry';
import { offsetToTimestamp } from '../utils/time';

import { Indexer } from './Indexer';

export type OneTimeDataObject = {
  name: string;
  objectID: string;
  updatedAt: string;
  changelogFilename: string | null;
};

export class OneTimeBackgroundIndexer extends Indexer<FinalPkg> {
  protected readonly facetField: string = '_oneTimeDataToUpdateAt';

  override get facetFilter(): string {
    const expired = offsetToTimestamp(0);

    // 0 === already processed
    // value in the future === errored and scheduled to retry later
    return `NOT ${this.facetField}:0 AND ${this.facetField} <= ${expired}`;
  }

  async patchObject(
    pkg: FinalPkg,
    patch: Partial<FinalPkg>,
    facetValue: number
  ): Promise<void> {
    await this.mainIndex
      .partialUpdateObject(
        {
          objectID: pkg.objectID,
          ...patch,
          [this.facetField]: facetValue,
          _revision: { _operation: 'IncrementFrom', value: pkg._revision },
        },
        { createIfNotExists: false }
      )
      .wait();
  }

  async recordExecutor(pkg: FinalPkg): Promise<void> {
    await this.queueTask(pkg);
  }

  override async stop(): Promise<void> {
    return super.stop(true);
  }

  async taskExecutor(pkg: FinalPkg): Promise<void> {
    try {
      const { metadata } = await getFileListMetadata(pkg);
      const { changelogFilename } = metadata.changelogFilename
        ? metadata
        : await getChangelogBackground(pkg);

      const data = {
        name: `${pkg.name}@${pkg.version}`,
        objectID: `${pkg.name}@${pkg.version}`,
        updatedAt: new Date().toISOString(),
        changelogFilename,
      };

      await Promise.all([
        this.algoliaStore.oneTimeDataIndex.saveObject(data),
        this.patchObject(
          pkg,
          {
            ...metadata,
            changelogFilename,
          },
          0
        ),
      ]);

      datadog.increment('oneTimeDataIndex.success');
    } catch (err) {
      datadog.increment('oneTimeDataIndex.failure');
      sentry.report(new Error(`Error in ${this.constructor.name}`), { err });

      await this.patchObject(
        pkg,
        {},
        offsetToTimestamp(ms('1 week'), new Date(pkg[this.facetField]))
      ).catch(() => {});
    }
  }
}

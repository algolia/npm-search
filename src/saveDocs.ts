import type { SearchIndex } from 'algoliasearch';

import type { FinalPkg, RawPkg } from './@types/pkg';
import { getChangelog } from './changelog';
import { config } from './config';
import type { OneTimeDataObject } from './indexers/OneTimeBackgroundIndexer';
import type { PeriodicDataObject } from './indexers/PeriodicBackgroundIndexer';
import * as jsDelivr from './jsDelivr';
import { getModuleTypes, getStyleTypes } from './jsDelivr/pkgTypes';
import * as npm from './npm';
import { computeDownload } from './npm';
import { getTypeScriptSupport } from './typescript';
import { datadog } from './utils/datadog';
import { offsetToTimestamp, round } from './utils/time';

export async function saveDoc({
  formatted,
  index,
  oneTimeDataIndex,
  periodicDataIndex,
}: {
  formatted: RawPkg;
  index: SearchIndex;
  oneTimeDataIndex: SearchIndex;
  periodicDataIndex: SearchIndex;
}): Promise<void> {
  const start = Date.now();
  const pkg = await addMetaData(formatted, oneTimeDataIndex, periodicDataIndex);

  const start2 = Date.now();
  await index.saveObject(pkg);
  datadog.timing('saveDocs.saveObject.one', Date.now() - start2);

  datadog.timing('saveDocs.one', Date.now() - start);
}

async function addMetaData(
  pkg: RawPkg,
  oneTimeDataIndex: SearchIndex,
  periodicDataIndex: SearchIndex
): Promise<FinalPkg> {
  const start = Date.now();
  let periodicDataUpdatedAt = 0;
  let download;

  if (pkg.isSecurityHeld) {
    return pkg;
  }

  const [dependent, hit] = [npm.getDependent(pkg), jsDelivr.getHit(pkg)];
  const { filelist, metadata } = await getFileListMetadata(pkg);

  let hasAllOneTimeData = Boolean(metadata.changelogFilename);
  let needsOneTimeReindex = !hasAllOneTimeData || !filelist.length;

  if (!hasAllOneTimeData) {
    try {
      const data = await oneTimeDataIndex.getObject<OneTimeDataObject>(
        `${pkg.name}@${pkg.version}`
      );

      datadog.increment('oneTimeDataIndex.hit');

      if (!metadata.changelogFilename) {
        metadata.changelogFilename = data.changelogFilename;
      }

      hasAllOneTimeData = true;
      needsOneTimeReindex = !hasAllOneTimeData || !filelist.length;
    } catch {
      datadog.increment('oneTimeDataIndex.miss');
    }
  }

  try {
    const data = await periodicDataIndex.getObject<PeriodicDataObject>(
      pkg.name
    );

    datadog.increment('periodicDataIndex.hit');

    download = computeDownload(
      pkg,
      data.packageNpmDownloads,
      data.totalNpmDownloads
    );

    periodicDataUpdatedAt = round(new Date(data.updatedAt)).valueOf();
  } catch {
    datadog.increment('periodicDataIndex.miss');
  }

  const final = {
    ...pkg,
    ...(download || {}),
    ...dependent,
    ...metadata,
    ...hit,
    popular: download?.popular || hit.popular,
    _oneTimeDataToUpdateAt: needsOneTimeReindex ? offsetToTimestamp(0) : 0,
    _periodicDataUpdatedAt: periodicDataUpdatedAt,
    _searchInternal: {
      ...pkg._searchInternal,
    },
  };

  final._searchInternal.popularAlternativeNames =
    getPopularAlternativeNames(final);

  datadog.timing('saveDocs.addMetaData.one', Date.now() - start);
  return final;
}

export async function getFileListMetadata(pkg: RawPkg): Promise<{
  filelist: Awaited<ReturnType<typeof jsDelivr.getFilesList>>;
  metadata: Awaited<ReturnType<typeof getChangelog>> &
    Awaited<ReturnType<typeof getModuleTypes>> &
    Awaited<ReturnType<typeof getStyleTypes>> &
    Awaited<ReturnType<typeof getTypeScriptSupport>>;
}> {
  const filelist = await jsDelivr.getFilesList(pkg);

  const [changelog, ts, moduleTypes, styleTypes] = await Promise.all([
    getChangelog(pkg, filelist),
    getTypeScriptSupport(pkg, filelist),
    getModuleTypes(pkg, filelist),
    getStyleTypes(pkg, filelist),
  ]);

  return {
    filelist,
    metadata: {
      ...changelog,
      ...ts,
      ...moduleTypes,
      ...styleTypes,
    },
  };
}

export function getPopularAlternativeNames(pkg: FinalPkg): string[] {
  const hasFewDownloads =
    pkg.downloadsLast30Days <= config.alternativeNamesNpmDownloadsThreshold &&
    pkg.jsDelivrHits <= config.alternativeNamesJsDelivrHitsThreshold;

  const addPopularAlternativeNames =
    pkg.popular ||
    (!pkg.isDeprecated && !pkg.isSecurityHeld && !hasFewDownloads);

  return addPopularAlternativeNames ? pkg._searchInternal.alternativeNames : [];
}

import type { SearchIndex } from 'algoliasearch';

import type { FinalPkg, RawPkg } from './@types/pkg';
import { getChangelog } from './changelog';
import { config } from './config';
import * as jsDelivr from './jsDelivr';
import { getModuleTypes, getStyleTypes } from './jsDelivr/pkgTypes';
import * as npm from './npm';
import { getTypeScriptSupport } from './typescript/index';
import { datadog } from './utils/datadog';

export async function saveDoc({
  formatted,
  index,
}: {
  formatted: RawPkg;
  index: SearchIndex;
}): Promise<void> {
  let start = Date.now();
  const pkg = await addMetaData(formatted);
  datadog.timing('saveDocs.addMetaData.one', Date.now() - start);

  start = Date.now();
  await index.saveObject(pkg);
  datadog.timing('saveDocs.saveObject.one', Date.now() - start);

  datadog.timing('saveDocs.one', Date.now() - start);
}

async function addMetaData(pkg: RawPkg): Promise<FinalPkg> {
  if (pkg.isSecurityHeld) {
    return pkg;
  }

  const [download, dependent, hit, filelist] = await Promise.all([
    npm.getDownload(pkg),
    npm.getDependent(pkg),
    jsDelivr.getHit(pkg),
    jsDelivr.getFilesList(pkg),
  ]);

  const [changelog, ts, moduleTypes, styleTypes] = await Promise.all([
    getChangelog(pkg, filelist),
    getTypeScriptSupport(pkg, filelist),
    getModuleTypes(pkg, filelist),
    getStyleTypes(pkg, filelist),
  ]);

  const start = Date.now();
  const final = {
    ...pkg,
    ...download,
    ...dependent,
    ...changelog,
    ...hit,
    ...ts,
    ...moduleTypes,
    ...styleTypes,
    _searchInternal: {
      ...pkg._searchInternal,
      ...(download ? download!._searchInternal : {}),
      ...hit._searchInternal,
    },
  };

  const hasFewDownloads =
    final.downloadsLast30Days <= config.alternativeNamesNpmDownloadsThreshold &&
    final.jsDelivrHits <= config.alternativeNamesJsDelivrHitsThreshold;

  const addPopularAlternativeNames =
    final.popular ||
    (!final.isDeprecated && !final.isSecurityHeld && !hasFewDownloads);

  if (addPopularAlternativeNames) {
    final._searchInternal.popularAlternativeNames =
      final._searchInternal.alternativeNames;
  }

  datadog.timing('saveDocs.addMetaData.one', Date.now() - start);
  return final;
}

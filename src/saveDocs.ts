import type { SearchIndex } from 'algoliasearch';

import type { FinalPkg, RawPkg } from './@types/pkg';
import { getChangelog } from './changelog';
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

  datadog.timing('saveDocs.addMetaData.one', Date.now() - start);
  return final;
}

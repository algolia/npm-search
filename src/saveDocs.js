import { getChangelogs } from './changelog';
import formatPkg from './formatPkg.js';
import * as jsDelivr from './jsDelivr';
import * as npm from './npm';
import { getTSSupport } from './typescriptSupport.js';
import { datadog } from './utils/datadog';
import { log } from './utils/log';

export default async function saveDocs({ docs, index }) {
  const start = Date.now();

  const rawPkgs = docs
    .filter(
      // must be a document & have a name
      (result) =>
        !result.deleted && result && result.doc && result.doc.name !== undefined
    )
    .map((result) => {
      const start1 = Date.now();

      const formatted = formatPkg(result.doc);

      datadog.timing('formatPkg', Date.now() - start1);
      return formatted;
    })
    .filter((pkg) => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('🔍 No pkgs found in response.');
    return Promise.resolve();
  }

  let start2 = Date.now();
  const pkgs = await addMetaData(rawPkgs);
  datadog.timing('saveDocs.addMetaData', Date.now() - start2);

  start2 = Date.now();
  await index.saveObjects(pkgs);
  datadog.timing('saveDocs.saveObjects', Date.now() - start2);

  datadog.timing('saveDocs', Date.now() - start);
  return pkgs.length;
}

async function addMetaData(pkgs) {
  const [downloads, dependents, changelogs, hits, ts] = await Promise.all([
    npm.getDownloads(pkgs),
    npm.getDependents(pkgs),
    getChangelogs(pkgs),
    jsDelivr.getHits(pkgs),
    getTSSupport(pkgs),
  ]);

  const start = Date.now();
  const all = pkgs.map((pkg, index) => ({
    ...pkg,
    ...downloads[index],
    ...dependents[index],
    ...changelogs[index],
    ...hits[index],
    ...ts[index],
    _searchInternal: {
      ...pkg._searchInternal,
      ...downloads[index]._searchInternal,
      ...dependents[index]._searchInternal,
      ...changelogs[index]._searchInternal,
      ...hits[index]._searchInternal,
    },
  }));
  datadog.timing('saveDocs.addMetaData', Date.now() - start);
  return all;
}

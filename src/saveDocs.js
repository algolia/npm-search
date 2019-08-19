import formatPkg from './formatPkg.js';
import log from './log.js';
import * as npm from './npm/index.js';
import * as changelog from './changelog.js';
import * as jsDelivr from './jsDelivr/index.js';
import * as typescript from './typescript/index.js';
import datadog from './datadog.js';

export default async function saveDocs({ docs, index }) {
  const start = Date.now();

  const rawPkgs = docs
    .filter(result => !result.deleted && result.doc.name !== undefined) // must be a document
    .map(result => {
      const start1 = Date.now();

      const formatted = formatPkg(result.doc);

      datadog.timing('formatPkg', Date.now() - start1);
      return formatted;
    })
    .filter(pkg => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('🔍 No pkgs found in response.');
    return Promise.resolve();
  }

  let start2 = Date.now();
  const pkgs = await addMetaData(rawPkgs);
  datadog.timing('saveDocs.addMetaData', Date.now() - start2);

  start2 = Date.now();
  index.saveObjects(pkgs);
  datadog.timing('saveDocs.saveObjects', Date.now() - start2);

  datadog.timing('saveDocs', Date.now() - start);
  return pkgs.length;
}

async function addMetaData(pkgs) {
  const [downloads, dependents, hits, filesLists] = await Promise.all([
    npm.getDownloads(pkgs),
    npm.getDependents(pkgs),
    jsDelivr.getHits(pkgs),
    jsDelivr.getFilesLists(pkgs),
  ]);

  const [changelogs, ts] = await Promise.all([
    changelog.getChangelogs(pkgs, filesLists),
    typescript.checkForSupportMultiple(pkgs, filesLists),
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

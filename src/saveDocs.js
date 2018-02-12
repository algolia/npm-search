import formatPkg from './formatPkg.js';
import log from './log.js';
import { getDownloads, getDependents } from './npm.js';
import { getChangelogs } from './changelog.js';

export default function saveDocs({ docs, index }) {
  const rawPkgs = docs
    .filter(result => result.doc.name !== undefined) // must be a document
    .map(result => formatPkg(result.doc))
    .filter(pkg => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('🔍 No pkgs found in response.');
    return Promise.resolve();
  }

  return addMetaData(rawPkgs)
    .then(pkgs => index.saveObjects(pkgs))
    .then(() => log.info('🔍 Found and saved %d packages', rawPkgs.length));
}

function addMetaData(pkgs) {
  return Promise.all([
    getDownloads(pkgs),
    getDependents(pkgs),
    getChangelogs(pkgs),
  ]).then(([downloads, dependents, changelogs]) =>
    pkgs.map((pkg, index) => ({
      ...pkg,
      ...downloads[index],
      ...dependents[index],
      ...changelogs[index],
    }))
  );
}

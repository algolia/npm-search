import algoliaIndex from './algoliaIndex.js';
import formatPackage from './formatPackage.js';
import log from './log.js';
import npm from './npm.js';

export default function saveChangesAndState(seq, changes) {
  const rawPkgs = changes
    .filter(result => result.doc.name !== undefined) // must be a document
    .map(result => formatPackage(result.doc))
    .filter(pkg => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('No pkgs found in changes.');
    return true;
  }

  return addMetaData(rawPkgs)
    .then(pkgs => algoliaIndex.saveObjects(pkgs))
    .then(() => log.info('Found and saved %d packages', rawPkgs.length));
}

function addMetaData(pkgs) {
  return npm.getDownloads(pkgs);
}

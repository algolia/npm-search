import type { SearchIndex } from 'algoliasearch';
import type { DocumentResponseRow } from 'nano';

import type { FinalPkg, RawPkg } from './@types/pkg';
import { getChangelogs } from './changelog';
import formatPkg from './formatPkg';
import * as jsDelivr from './jsDelivr';
import * as npm from './npm';
import type { GetPackage } from './npm/types';
import { getTSSupport } from './typescript/index';
import { datadog } from './utils/datadog';
import { log } from './utils/log';

export default async function saveDocs({
  docs,
  index,
}: {
  docs: Array<DocumentResponseRow<GetPackage>>;
  index: SearchIndex;
}): Promise<number> {
  const start = Date.now();
  const names: string[] = [];

  const rawPkgs = docs
    .map((result) => {
      const start1 = Date.now();

      const formatted = formatPkg(result.doc!);

      datadog.timing('formatPkg', Date.now() - start1);

      if (formatted) {
        names.push(formatted.name);
      }

      return formatted;
    })
    .filter<RawPkg>((pkg): pkg is RawPkg => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('🔍 No pkgs found in response.');
    return Promise.resolve(0);
  }
  log.info('  => ', names);
  log.info('  Adding metadata...');

  let start2 = Date.now();
  const pkgs = await addMetaData(rawPkgs);
  datadog.timing('saveDocs.addMetaData', Date.now() - start2);

  log.info(` Saving...`);

  start2 = Date.now();
  await index.saveObjects(pkgs);
  datadog.timing('saveDocs.saveObjects', Date.now() - start2);

  log.info(`  Saved`);

  datadog.timing('saveDocs', Date.now() - start);
  return pkgs.length;
}

async function addMetaData(pkgs: RawPkg[]): Promise<FinalPkg[]> {
  const [downloads, dependents, hits, filelists] = await Promise.all([
    npm.getDownloads(pkgs),
    npm.getDependents(pkgs),
    jsDelivr.getHits(pkgs),
    jsDelivr.getAllFilesList(pkgs),
  ]);

  const [changelogs, ts] = await Promise.all([
    getChangelogs(pkgs, filelists),
    getTSSupport(pkgs, filelists),
  ]);

  const start = Date.now();
  const all: FinalPkg[] = pkgs.map((pkg, index) => {
    return {
      ...pkg,
      ...downloads[index],
      ...dependents[index],
      ...changelogs[index],
      ...hits[index],
      ...ts[index],
      _searchInternal: {
        ...pkg._searchInternal,
        ...(downloads[index] ? downloads[index]!._searchInternal : {}),
        ...hits[index]._searchInternal,
      },
    };
  });

  datadog.timing('saveDocs.addMetaData', Date.now() - start);
  return all;
}

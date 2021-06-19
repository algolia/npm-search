import type { SearchIndex } from 'algoliasearch';
import type nano from 'nano';

import type { FinalPkg, RawPkg } from './@types/pkg';
import { getChangelogs } from './changelog';
import formatPkg from './formatPkg';
import * as jsDelivr from './jsDelivr';
import * as npm from './npm';
import type { GetPackage } from './npm/types';
import { getTSSupport } from './typescriptSupport';
import { datadog } from './utils/datadog';
import { log } from './utils/log';

export default async function saveDocs({
  docs,
  index,
}: {
  docs: Array<nano.DocumentResponseRow<GetPackage>>;
  index: SearchIndex;
}): Promise<number> {
  const start = Date.now();

  const rawPkgs = docs
    .filter(
      // must be a document & have a name
      (result) => {
        return (
          // @ts-expect-error Docs is either a doc or changes, the types or the values need to be checked
          !result.deleted &&
          result &&
          result.doc &&
          result.doc.name !== undefined
        );
      }
    )
    .map((result) => {
      const start1 = Date.now();

      const formatted = formatPkg(result.doc!);

      datadog.timing('formatPkg', Date.now() - start1);
      return formatted;
    })
    .filter<RawPkg>((pkg): pkg is RawPkg => pkg !== undefined);

  if (rawPkgs.length === 0) {
    log.info('🔍 No pkgs found in response.');
    return Promise.resolve(0);
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

async function addMetaData(pkgs: RawPkg[]): Promise<FinalPkg[]> {
  const [downloads, dependents, changelogs, hits, ts] = await Promise.all([
    npm.getDownloads(pkgs),
    npm.getDependents(pkgs),
    getChangelogs(pkgs),
    jsDelivr.getHits(pkgs),
    getTSSupport(pkgs),
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

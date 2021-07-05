import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
import type { File } from '../jsDelivr';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import { request } from '../utils/request';

interface TypeList {
  p: string; // url
  l: string; // display name
  t: string; // package name
  // don't known
  d: number;
  g: string[];
  m: string[];
}

export const typesCache: Record<string, string> = {};

/**
 * Microsoft build a index.json with all @types/* on each publication.
 * - https://github.com/microsoft/types-publisher/blob/master/src/create-search-index.ts.
 */
export async function loadTypesIndex(): Promise<void> {
  const start = Date.now();
  const { body } = await request<TypeList[]>(config.typescriptTypesIndex, {
    decompress: true,
    responseType: 'json',
  });

  log.info(`📦  Typescript preload, found ${body.length} @types`);

  // m = modules associated
  // t = @types/<name>
  body.forEach((type) => {
    typesCache[unmangle(type.t)] = type.t;
  });

  datadog.timing('typescript.loadTypesIndex', Date.now() - start);
}

export function isDefinitelyTyped({ name }): string | undefined {
  return typesCache[unmangle(name)];
}

export function unmangle(name: string): string {
  // https://github.com/algolia/npm-search/pull/407/files#r316562095
  return name.replace('__', '/').replace('@', '');
}

/**
 * Basically either
 *   - { types: { ts: false }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module.
 */
export function getTypeScriptSupport(
  pkg: Pick<RawPkg, 'name' | 'types' | 'version'>,
  filelist: File[]
): Pick<RawPkg, 'types'> {
  // Already calculated in `formatPkg`
  if (pkg.types.ts === 'included') {
    return { types: pkg.types };
  }

  // The 2nd most likely is definitely typed
  const defTyped = isDefinitelyTyped({ name: pkg.name });
  if (defTyped) {
    return {
      types: {
        ts: 'definitely-typed',
        definitelyTyped: `@types/${defTyped}`,
      },
    };
  }

  for (const file of filelist) {
    if (!file.name.endsWith('.d.ts')) {
      // eslint-disable-next-line no-continue
      continue;
    }

    datadog.increment('jsdelivr.getTSSupport.hit');

    return { types: { ts: 'included' } };
  }
  datadog.increment('jsdelivr.getTSSupport.miss');

  return { types: { ts: false } };
}

/**
 * Check if packages have Typescript definitions.
 */
export async function getTSSupport(
  pkgs: Array<Pick<RawPkg, 'name' | 'types' | 'version'>>,
  filelists: File[][]
): Promise<Array<Pick<RawPkg, 'types'>>> {
  const start = Date.now();

  const all = await Promise.all(
    pkgs.map((pkg, index) => {
      return getTypeScriptSupport(pkg, filelists[index] || []);
    })
  );

  datadog.timing('getTSSupport', Date.now() - start);
  return all;
}

import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
import type { File } from '../jsDelivr';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import { request } from '../utils/request';

export const typesCache: Record<string, string> = Object.create(null);

type TypesEntry = {
  p: string | null; // package repo
  l: string | null; // package name
  t: string; // @types package name
};

/**
 * Microsoft build a index.json with all @types/* on each publication.
 * - https://github.com/microsoft/types-publisher/blob/master/src/create-search-index.ts.
 */
export async function loadTypesIndex(): Promise<void> {
  const start = Date.now();

  const { body: data } = await request<TypesEntry[]>(
    config.typescriptTypesIndex,
    {
      decompress: true,
      responseType: 'json',
    }
  );

  log.info(`📦  Typescript preload, found ${data.length} @types`);

  data.forEach((entry) => {
    if (entry.l) {
      typesCache[entry.l] = entry.t;
    }
  });

  datadog.timing('typescript.loadTypesIndex', Date.now() - start);
}

export function isDefinitelyTyped({ name }): string | undefined {
  return typesCache[name];
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
  const start = Date.now();

  try {
    // Already calculated in `formatPkg`
    if (pkg.types.ts === 'included') {
      return { types: pkg.types };
    }

    for (const file of filelist) {
      if (!file.name.endsWith('.d.ts')) {
        continue;
      }

      datadog.increment('jsdelivr.getTSSupport.hit');

      return { types: { ts: 'included' } };
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
    datadog.increment('jsdelivr.getTSSupport.miss');

    return { types: { ts: false } };
  } finally {
    datadog.timing('typescript.getSupport', Date.now() - start);
  }
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

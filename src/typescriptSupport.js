import * as npm from './npm/index.js';
import { fileExistsInUnpkg } from './unpkg';
import { datadog } from './utils/datadog';

/**
 * Basically either
 *   - { types: { ts: false }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module.
 *
 */
export async function getTypeScriptSupport(pkg) {
  // Already calculated in `formatPkg`
  if (typeof pkg.types.ts === 'string') {
    return { types: pkg.types };
  }

  // The 2nd most likely is definitely typed
  const defTypeName = `@types/${pkg.name.replace('@', '').replace('/', '__')}`;
  const defTyped = await npm.validatePackageExists(defTypeName);
  if (defTyped) {
    return {
      types: {
        ts: 'definitely-typed',
        definitelyTyped: defTypeName,
      },
    };
  }

  if (pkg.types.ts === false) {
    return { types: { ts: false } };
  }

  // Do we have a main .d.ts file?
  if (pkg.types.ts.possible === true) {
    const resolved = await fileExistsInUnpkg(
      pkg.name,
      pkg.version,
      pkg.types.ts.dtsMain
    );
    if (resolved) {
      return { types: { ts: 'included' } };
    }
  }

  return { types: { ts: false } };
}

/**
 * @param {Array<Package>} pkgs
 */
export async function getTSSupport(pkgs) {
  const start = Date.now();

  const all = await Promise.all(pkgs.map(getTypeScriptSupport));

  datadog.timing('getTSSupport', Date.now() - start);
  return all;
}

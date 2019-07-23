// @ts-check

import { validatePackageExists } from './npm.js';
import { fileExistsInUnpkg } from './unpkg.js';

/**
 * @typedef Package
 * @property {string} name
 * @property {string} version
 * @property {{ ts: 'included' | {possible: boolean, dtsMain: string} | false }} types
 */

/**
 * Basically either
 *   - { types: { ts: false }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module
 * @param {Package} pkg
 */
export async function getTypeScriptSupport(pkg) {
  // Already calculated in `formatPkg`
  if (typeof pkg.types.ts === 'string') {
    return { types: pkg.types };
  }

  // The 2nd most likely is definitely typed
  const defTypeName = `@types/${pkg.name}`;
  const defTyped = await validatePackageExists(defTypeName);
  if (defTyped) {
    return { types: { ts: defTypeName } };
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
export function getTSSupport(pkgs) {
  return Promise.all(pkgs.map(getTypeScriptSupport));
}

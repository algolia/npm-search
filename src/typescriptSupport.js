// @ts-check

import { validatePackageExists } from './npm.js';
import { fileExistsInUnpkg } from './unpkg.js';

/**
 * @typedef Package
 * @property {string} name
 * @property {string} version
 * @property {string} [main]
 * @property {string} [types]
 * @property {string} [typings]
 */

/**
 * Basically either
 *   - { types: { ts: null }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module
 * @param {Package} pkg
 */
export async function getTypeScriptSupport(pkg) {
  // Already calculated in `formatPkg`
  if (pkg.types) {
    return { types: pkg.types };
  }

  // The 2nd most likely is definitely typed
  const defTypeName = `@types/${pkg.name}`;
  const defTyped = await validatePackageExists(defTypeName);
  if (defTyped) {
    return { types: { ts: defTypeName } };
  }

  // Check if main's JS file can be resolved to a d.ts file instead
  const main = pkg.main || 'index.js';
  if (main.endsWith('.js')) {
    const dtsMain = main.replace(/js$/, 'd.ts');
    const resolved = await fileExistsInUnpkg(pkg.name, pkg.version, dtsMain);
    if (resolved) {
      return { types: { ts: 'included' } };
    }
  }

  return { types: { ts: null } };
}

/**
 * @param {Array<Package>} pkgs
 */
export function getTSSupport(pkgs) {
  return Promise.all(pkgs.map(getTypeScriptSupport));
}

// @ts-check

import { validatePackageExists } from './npm.js';
import { fileExistsInUnpkg } from './unpkg.js';

/**
 * Basically either
 *  - { ts: undefined }  for no existing TypeScript support
 *  - { ts: "@types/module" } - for definitely typed support
 *  - { ts: "included" } - for types shipped with the module
 * */
export async function getTypeScriptSupportString(pkg) {
  // The cheap and simple (+ recommended by TS) way
  // of adding a types section to your package.json
  if (pkg.types) {
    return { ts: 'included' };
  }

  // Older, but still works way of defining your types
  if (pkg.typings) {
    return { ts: 'included' };
  }

  // The 2nd most likely is definitely typed
  const defTypeName = `@types/${pkg.name}`;
  const defTyped = await validatePackageExists(defTypeName);
  if (defTyped) {
    return { ts: defTypeName };
  }

  // Check if main's JS file can be resolved to a d.ts file instead
  const main = pkg.main || 'index.js';
  if (main.endsWith('.js')) {
    const dtsMain = main.replace(/js$/, 'd.ts');
    const resolved = await fileExistsInUnpkg(pkg.name, pkg.version, dtsMain);
    if (resolved) {
      return { ts: 'included' };
    }
  }

  return { ts: undefined };
}

export function getTSSupport(pkgs) {
  return Promise.all(pkgs.map(getTypeScriptSupportString));
}

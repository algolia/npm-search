import got from 'got';

import config from '../config.js';
import datadog from '../datadog.js';
import log from '../log.js';

const typesCache = {};

/**
 * Microsoft build a index.json with all @types/* on each publication
 * https://github.com/microsoft/types-publisher/blob/master/src/create-search-index.ts
 *
 */
async function loadTypesIndex() {
  const start = Date.now();
  const { body } = await got(config.typescriptTypesIndex, {
    decompress: true,
    json: true,
  });

  log.info(`📦  Typescript preload, found ${body.length} @types`);

  // m = modules associate
  // t = @types/<name>
  body.forEach(type => {
    type.m.forEach(m => {
      typesCache[m] = type.t;
    });
  });

  datadog.timing('typescript.loadTypesIndex', Date.now() - start);
}

function isDefinitelyTyped({ name }) {
  return typesCache[name];
}

/**
 * Basically either
 *   - { types: { ts: false }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module
 * @param {Package} pkg
 */
export function checkForSupport(pkg) {
  // Already calculated in `formatPkg`
  if (typeof pkg.types.ts === 'string') {
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

  return { types: { ts: false } };
}

/**
 * Check if packages have Typescript definitions
 * @param {Array<Package>} pkgs
 */
async function checkForSupportMultiple(pkgs) {
  const start = Date.now();

  const all = await Promise.all(pkgs.map(checkForSupport));

  datadog.timing('getTSSupport', Date.now() - start);
  return all;
}

export {
  loadTypesIndex,
  typesCache,
  isDefinitelyTyped,
  checkForSupportMultiple,
};

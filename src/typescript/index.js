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

  // m = modules associated
  // t = @types/<name>
  body.forEach(type => {
    typesCache[unmangle(type.t)] = type.t;
  });

  datadog.timing('typescript.loadTypesIndex', Date.now() - start);
}

function isDefinitelyTyped({ name }) {
  return typesCache[unmangle(name)];
}

function unmangle(name) {
  return name.replace('__', '/').replace('@', '');
}

/**
 * Basically either
 *   - { types: { ts: false }}  for no existing TypeScript support
 *   - { types: { ts: "@types/module" }} - for definitely typed support
 *   - { types: { ts: "included" }} - for types shipped with the module
 * @param {Package} pkg
 */
export function checkForSupport(pkg, filesList) {
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
        _where: 'deftyped',
        definitelyTyped: `@types/${defTyped}`,
      },
    };
  }

  // Check in fileList
  if (
    filesList &&
    filesList.length > 0 &&
    filesList.some(file => file.name.endsWith('.d.ts'))
  ) {
    return {
      types: {
        ts: 'included',
        _where: 'filesList',
      },
    };
  }

  return { types: { ts: false } };
}

/**
 * Check if packages have Typescript definitions
 * @param {Array<Package>} pkgs
 */
async function checkForSupportMultiple(pkgs, filesLists) {
  const start = Date.now();

  const all = await Promise.all(
    pkgs.map((pkg, index) => {
      return checkForSupport(pkg, filesLists[index]);
    })
  );

  datadog.timing('getTSSupport', Date.now() - start);
  return all;
}

export {
  loadTypesIndex,
  typesCache,
  isDefinitelyTyped,
  checkForSupportMultiple,
};

import got from 'got';
import log from '../log.js';
import config from '../config.js';
import datadog from '../datadog.js';

const hits = new Map();

/**
 * Load downloads hits
 */
async function loadHits() {
  const start = Date.now();
  log.info('📦  Loading hits from jsDelivr');

  try {
    const { body: hitsJSON } = await got(config.jsDelivrHitsEndpoint, {
      json: true,
    });
    hits.clear();
    hitsJSON.forEach(pkg => {
      hits.set(pkg.name, pkg.hits);
    });
  } catch (e) {
    log.error(e);
  }

  datadog.timing('jsdelivr.loadHits', Date.now() - start);
}

/**
 * Get download hits
 * @param {array} pkgs
 */
function getHits(pkgs) {
  const start = Date.now();
  const all = pkgs.map(({ name }) => {
    const jsDelivrHits = hits.get(name) || 0;

    return {
      jsDelivrHits,
      _searchInternal: {
        // anything below 1000 hits/month is likely to mean that
        // someone just made a few random requests so we count that as 0
        jsDelivrPopularity: Math.max(jsDelivrHits.toString().length - 3, 0),
      },
    };
  });

  datadog.timing('jsdelivr.getHits', Date.now() - start);
  return all;
}

/**
 * Get packages files list
 * @param {array} pkgs
 */
async function getAllFilesList(pkgs) {
  const start = Date.now();

  const files = await Promise.all(pkgs.map(getFilesList));

  datadog.timing('jsdelivr.getAllFilesList', Date.now() - start);
  return files;
}

/**
 * Get one package files list
 * @param {object} pkg
 */
async function getFilesList(pkg) {
  const start = Date.now();
  if (!pkg.name || !pkg.name.includes('@')) {
    throw new Error(
      `Package name should contain a version number: ${pkg.name}`
    );
  }

  let files = [];
  try {
    const response = await got(
      `${config.jsDelivrPackageEndpoint}/${pkg.name}/flat`,
      {
        json: true,
      }
    );
    files = response.body.files;
  } catch (e) {
    log.warn(e);
  }

  datadog.timing('jsdelivr.getFilesList', Date.now() - start);
  return files;
}

export { hits, loadHits, getHits, getAllFilesList, getFilesList };

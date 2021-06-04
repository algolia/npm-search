import chunk from 'lodash/chunk.js';
import nano from 'nano';
import numeral from 'numeral';

import config from '../config.js';
import datadog from '../datadog.js';
import log from '../log.js';
import { request } from '../utils/request.js';

const registry = nano({
  url: config.npmRegistryEndpoint,
});
const db = registry.use(config.npmRegistryDBName);

// Default request options
const defaultOptions = {
  include_docs: true,
  conflicts: false,
  attachments: false,
};

/**
 * Find all packages in registry.
 *
 * @param {object} options - Options param.
 */
async function findAll(options) {
  const start = Date.now();

  const results = await db.list({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.allDocs', Date.now() - start);

  return results;
}

async function getChanges(options) {
  const start = Date.now();

  const results = await db.changes({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.getChanges', Date.now() - start);

  return results;
}

async function getDocs({ keys }) {
  const start = Date.now();

  const docs = await db.fetch({ keys });

  datadog.timing('npm.getDocs', Date.now() - start);

  return docs;
}

/**
 * Listen to changes in registry.
 *
 * @param {object} options - Options param.
 */
function listenToChanges(options) {
  const listener = db.follow({
    ...defaultOptions,
    ...options,
  });
  listener.on('confirm', () => {
    log.info('Registry is confirmed/connected');
  });
  listener.on('catchup', () => {
    log.info('Watch has catchup');
  });
  listener.on('retry', (info) => {
    log.info('Registry is retrying to connect', info);
  });
  listener.on('timeout', (info) => {
    log.info('Watch has timeouted', info);
  });
  listener.on('stop', () => {
    log.info('Watch has stopped');
  });

  return listener;
}

/**
 * Get info about registry.
 */
async function getInfo() {
  const start = Date.now();

  const {
    body: { doc_count: nbDocs, update_seq: seq },
  } = await request(config.npmRegistryEndpoint, {
    responseType: 'json',
  });

  datadog.timing('npm.info', Date.now() - start);

  return {
    nbDocs,
    seq,
  };
}

/**
 * Validate if a package exists.
 *
 * @param {string} pkgName - Package name.
 */
async function validatePackageExists(pkgName) {
  const start = Date.now();

  let exists;
  try {
    const response = await request(`${config.npmRootEndpoint}/${pkgName}`, {
      method: 'HEAD',
    });
    exists = response.statusCode === 200;
  } catch (e) {
    exists = false;
  }

  datadog.timing('npm.validatePackageExists', Date.now() - start);
  return exists;
}

/**
 * Get list of packages that depends of them.
 *
 * @param {Array} pkgs - Package list.
 */
function getDependents(pkgs) {
  // we return 0, waiting for https://github.com/npm/registry/issues/361
  return Promise.all(
    pkgs.map(() => ({
      dependents: 0,
      humanDependents: '0',
    }))
  );
}

/**
 * Get total npm downloads.
 */
async function getTotalDownloads() {
  const {
    body: { downloads: totalNpmDownloadsPerDay },
  } = await request(`${config.npmDownloadsEndpoint}/range/last-month`, {
    responseType: 'json',
  });

  return totalNpmDownloadsPerDay.reduce(
    (total, { downloads: dayDownloads }) => total + dayDownloads,
    0
  );
}

/**
 * Get download stats for a list of packages.
 *
 * @param {string} pkgNames - Packages name.
 */
async function getDownload(pkgNames) {
  try {
    const response = await request(
      `${config.npmDownloadsEndpoint}/point/last-month/${pkgNames}`,
      {
        responseType: 'json',
      }
    );
    if (response.body.downloads) {
      return { body: { [response.body.package]: response.body } };
    }
    return response;
  } catch (error) {
    log.warn(`An error ocurred when getting download of ${pkgNames} ${error}`);
    return { body: {} };
  }
}

/**
 * Get downloads for all packages passer in arguments.
 *
 * @param {Array} pkgs - Packages.
 */
async function getDownloads(pkgs) {
  const start = Date.now();

  // npm has a weird API to get downloads via GET params, so we split pkgs into chunks
  // and do multiple requests to avoid weird cases when concurrency is high
  const encodedPackageNames = pkgs
    .map((pkg) => pkg.name)
    .filter((name) => name[0] !== '@' /* downloads for scoped packages fails */)
    .map((name) => encodeURIComponent(name));
  const encodedScopedPackageNames = pkgs
    .map((pkg) => pkg.name)
    .filter((name) => name[0] === '@')
    .map((name) => encodeURIComponent(name));

  // why do we do this? see https://github.com/npm/registry/issues/104
  encodedPackageNames.unshift('');
  const pkgsNamesChunks = chunk(encodedPackageNames, 100).map((names) =>
    names.join(',')
  );

  const totalNpmDownloads = await getTotalDownloads();

  const downloadsPerPkgNameChunks = await Promise.all([
    ...pkgsNamesChunks.map(getDownload),
    ...encodedScopedPackageNames.map(getDownload),
  ]);

  const downloadsPerPkgName = downloadsPerPkgNameChunks.reduce(
    (res, { body: downloadsPerPkgNameChunk }) => ({
      ...res,
      ...downloadsPerPkgNameChunk,
    }),
    {}
  );

  const all = pkgs.map(({ name }) => {
    if (downloadsPerPkgName[name] === undefined) {
      return {};
    }

    const downloadsLast30Days = downloadsPerPkgName[name]
      ? downloadsPerPkgName[name].downloads
      : 0;
    const downloadsRatio = (downloadsLast30Days / totalNpmDownloads) * 100;
    const popular = downloadsRatio > config.popularDownloadsRatio;
    const downloadsMagnitude = downloadsLast30Days
      ? downloadsLast30Days.toString().length
      : 0;

    return {
      downloadsLast30Days,
      humanDownloadsLast30Days: numeral(downloadsLast30Days).format('0.[0]a'),
      downloadsRatio,
      popular,
      _searchInternal: {
        // if the package is popular, we copy its name to a dedicated attribute
        // which will make popular records' `name` matches to be ranked higher than other matches
        // see the `searchableAttributes` index setting
        ...(popular && { popularName: name }),
        downloadsMagnitude,
      },
    };
  });

  datadog.timing('npm.getDownloads', Date.now() - start);
  return all;
}

export {
  findAll,
  listenToChanges,
  getChanges,
  getInfo,
  getDocs,
  validatePackageExists,
  getDependents,
  getDownload,
  getDownloads,
};

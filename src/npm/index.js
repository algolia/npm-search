import got from 'got';
import ms from 'ms';
import PouchDB from 'pouchdb-http';
import chunk from 'lodash/chunk.js';
import numeral from 'numeral';

import config from '../config.js';
import datadog from '../datadog.js';
import log from '../log';

const db = new PouchDB(config.npmRegistryEndpoint, {
  ajax: {
    timeout: ms('2.5m'), // default is 10s
  },
});

// Default request options
const defaultOptions = {
  include_docs: true, // eslint-disable-line camelcase
  conflicts: false,
  attachments: false,
};

/**
 * Find all packages in registry
 *
 * @param {object} options Options param
 */
async function findAll(options) {
  const start2 = Date.now();

  const results = await db.allDocs({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.allDocs', Date.now() - start2);

  return results;
}

/**
 * Listen to changes in registry
 *
 * @param {object} options Options param
 */
function listenToChanges(options) {
  const start2 = Date.now();

  const changes = db.changes({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.changes', Date.now() - start2);

  return changes;
}

/**
 * Get info about registry
 */
async function getInfo() {
  const start = Date.now();

  const {
    body: { doc_count: nbDocs, update_seq: seq },
  } = await got(config.npmRegistryEndpoint, {
    json: true,
  });

  datadog.timing('npm.info', Date.now() - start);

  return {
    nbDocs,
    seq,
  };
}

/**
 * Validate if a package exists
 *
 * @param {string} pkgName Package name
 */
async function validatePackageExists(pkgName) {
  const start = Date.now();

  let exists;
  try {
    const response = await got(`${config.npmRootEndpoint}/${pkgName}`, {
      json: true,
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
 * Get list of packages that depends of them
 *
 * @param {Array} pkgs Package list
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
 * Get total npm downloads
 */
async function getTotalDownloads() {
  const {
    body: { downloads: totalNpmDownloadsPerDay },
  } = await got(`${config.npmDownloadsEndpoint}/range/last-month`, {
    json: true,
  });

  return totalNpmDownloadsPerDay.reduce(
    (total, { downloads: dayDownloads }) => total + dayDownloads,
    0
  );
}

/**
 * Get download stats for a list of packages
 *
 * @param {string} pkgNames Packages name
 */
async function getDownload(pkgNames) {
  try {
    const response = await got(
      `${config.npmDownloadsEndpoint}/point/last-month/${pkgNames}`,
      {
        json: true,
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
 * Get downloads for all packages passer in arguments
 *
 * @param {array} pkgs Packages
 */
async function getDownloads(pkgs) {
  const start = Date.now();

  // npm has a weird API to get downloads via GET params, so we split pkgs into chunks
  // and do multiple requests to avoid weird cases when concurrency is high
  const encodedPackageNames = pkgs
    .map(pkg => pkg.name)
    .filter(name => name[0] !== '@' /* downloads for scoped packages fails */)
    .map(name => encodeURIComponent(name));
  const encodedScopedPackageNames = pkgs
    .map(pkg => pkg.name)
    .filter(name => name[0] === '@')
    .map(name => encodeURIComponent(name));

  // why do we do this? see https://github.com/npm/registry/issues/104
  encodedPackageNames.unshift('');
  const pkgsNamesChunks = chunk(encodedPackageNames, 100).map(names =>
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
  getInfo,
  validatePackageExists,
  getDependents,
  getDownload,
  getDownloads,
};

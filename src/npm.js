import got from 'got';
import chunk from 'lodash/chunk.js';
import numeral from 'numeral';

import c from './config.js';
import log from './log.js';
import datadog from './datadog.js';

export async function info() {
  const start = Date.now();

  const {
    body: { doc_count: nbDocs, update_seq: seq },
  } = await got(c.npmRegistryEndpoint, {
    json: true,
  });

  datadog.timing('npm.info', Date.now() - start);

  return {
    nbDocs,
    seq,
  };
}

const logWarning = ({ error, type, packagesStr }) => {
  log.warn(
    `Something went wrong asking the ${type} for "${packagesStr}" "${error}"`
  );
};

export async function validatePackageExists(pkgName) {
  const start = Date.now();

  let exists;
  try {
    const response = await got(`${c.npmRootEndpoint}/${pkgName}`, {
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

export async function getDownloads(pkgs) {
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

  const {
    body: { downloads: totalNpmDownloadsPerDay },
  } = await got(`${c.npmDownloadsEndpoint}/range/last-month`, {
    json: true,
  });
  const totalNpmDownloads = totalNpmDownloadsPerDay.reduce(
    (total, { downloads: dayDownloads }) => total + dayDownloads,
    0
  );

  const downloadsPerPkgNameChunks = await Promise.all([
    ...pkgsNamesChunks.map(async pkgsNames => {
      try {
        return await got(
          `${c.npmDownloadsEndpoint}/point/last-month/${pkgsNames}`,
          {
            json: true,
          }
        );
      } catch (error) {
        logWarning({
          error,
          type: 'downloads',
          packagesStr: pkgsNames,
        });
        return { body: {} };
      }
    }),
    ...encodedScopedPackageNames.map(async pkg => {
      try {
        const res = await got(
          `${c.npmDownloadsEndpoint}/point/last-month/${pkg}`,
          {
            json: true,
          }
        );
        return { body: { [res.body.package]: res.body } };
      } catch (error) {
        logWarning({
          error,
          type: 'scoped downloads',
          packagesStr: pkg,
        });
        return { body: {} };
      }
    }),
  ]);

  const downloadsPerPkgName = downloadsPerPkgNameChunks.reduce(
    (res, { body: downloadsPerPkgNameChunk }) => ({
      ...res,
      ...downloadsPerPkgNameChunk,
    }),
    {}
  );

  return pkgs.map(({ name }) => {
    if (downloadsPerPkgName[name] === undefined) {
      datadog.timing('npm.getDownloads', Date.now() - start);
      return {};
    }

    const downloadsLast30Days = downloadsPerPkgName[name]
      ? downloadsPerPkgName[name].downloads
      : 0;
    const downloadsRatio = (downloadsLast30Days / totalNpmDownloads) * 100;
    const popular = downloadsRatio > c.popularDownloadsRatio;
    const downloadsMagnitude = downloadsLast30Days
      ? downloadsLast30Days.toString().length
      : 0;

    datadog.timing('npm.getDownloads', Date.now() - start);
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
}

export function getDependents(pkgs) {
  // we return 0, waiting for https://github.com/npm/registry/issues/361
  return Promise.all(
    pkgs.map(() => ({
      dependents: 0,
      humanDependents: '0',
    }))
  );
}

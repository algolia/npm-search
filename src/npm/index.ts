import { HTTPError } from 'got';
import _ from 'lodash';
import ms from 'ms';
import type {
  DocumentGetResponse,
  DocumentListParams,
  DocumentListResponse,
} from 'nano';
import nano from 'nano';
import numeral from 'numeral';
import PQueue from 'p-queue';

import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
import { PackageNotFoundError } from '../errors';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import { httpsAgent, request, USER_AGENT } from '../utils/request';

import type { GetInfo, GetPackage, PackageDownload } from './types';

type GetDependent = { dependents: number; humanDependents: string };
type GetDownload = {
  downloadsLast30Days: number;
  humanDownloadsLast30Days: string;
  downloadsRatio: number;
  popular: boolean;
  _downloadsMagnitude: number;
  _popularName?: string;
};
export type DownloadsData = {
  totalNpmDownloads?: number;
  packageNpmDownloads?: number;
};
export const cacheTotalDownloads: { total?: number; date?: number } = {
  total: undefined,
  date: undefined,
};

const registry = nano({
  url: config.npmRegistryEndpoint,
  requestDefaults: {
    agent: httpsAgent,
    timeout: 30000,
    headers: {
      'user-agent': USER_AGENT,
      'Accept-Encoding': 'deflate, gzip',
      'content-type': 'application/json',
      accept: 'application/json',
    },
  },
});

export const db = registry.use<GetPackage>(config.npmRegistryDBName);
const registryQueue = new PQueue({ intervalCap: 6, interval: 1000 });
const downloadsQueue = new PQueue({ intervalCap: 6, interval: 1000 });

/**
 * Find all packages in registry.
 */
async function findAll(
  options: Partial<DocumentListParams>
): Promise<DocumentListResponse<GetPackage>> {
  const start = Date.now();

  const results = await db.list({
    ...options,
  });

  datadog.timing('db.allDocs', Date.now() - start);

  return results;
}

async function getDoc(
  name: string,
  rev: string
): Promise<DocumentGetResponse & GetPackage> {
  const start = Date.now();

  const doc = await registryQueue.add(() => db.get(name, { rev }));

  datadog.timing('npm.getDoc.one', Date.now() - start);

  return doc;
}

async function getDocFromRegistry(
  name: string
): Promise<DocumentGetResponse & GetPackage> {
  const start = Date.now();

  try {
    const doc = await request<DocumentGetResponse & GetPackage>(
      `${config.npmRootEndpoint}/${name}`,
      { responseType: 'json' }
    );

    // Package without versions means it was unpublished.
    // Treat it the same as if it was not found at all.
    if (_.isEmpty(doc.body.versions)) {
      throw new PackageNotFoundError();
    }

    return doc.body;
  } catch (e) {
    if (e instanceof HTTPError && e.response.statusCode === 404) {
      throw new PackageNotFoundError();
    }

    throw e;
  } finally {
    datadog.timing('npm.getDocRegistry.one', Date.now() - start);
  }
}

/**
 * Get info about registry.
 */
async function getInfo(): Promise<{ nbDocs: number; seq: number }> {
  const start = Date.now();

  const {
    body: { doc_count: nbDocs, update_seq: seq },
  } = await request<GetInfo>(config.npmRegistryEndpoint, {
    responseType: 'json',
  });

  datadog.timing('npm.info', Date.now() - start);

  return {
    nbDocs,
    seq,
  };
}

/**
 * Get list of packages that depends of them.
 *
 * @param pkgs - Package list.
 */
function getDependents(
  pkgs: Array<Pick<RawPkg, 'name'>>
): Promise<GetDependent[]> {
  // we return 0, waiting for https://github.com/npm/registry/issues/361
  return Promise.all(pkgs.map(getDependent));
}

function getDependent(_pkg: Pick<RawPkg, 'name'>): GetDependent {
  return { dependents: 0, humanDependents: '0' };
}

async function loadTotalDownloads(): Promise<void> {
  const start = Date.now();

  const {
    body: { downloads: totalNpmDownloadsPerDay },
  } = await request<{ downloads: Array<{ downloads: number }> }>(
    `${config.npmDownloadsEndpoint}/range/last-month`,
    {
      responseType: 'json',
    }
  );

  const total = totalNpmDownloadsPerDay.reduce(
    (agg, { downloads: dayDownloads }) => agg + dayDownloads,
    0
  );

  cacheTotalDownloads.date = start;
  cacheTotalDownloads.total = total;

  datadog.timing('npm.loadTotalDownloads', Date.now() - start);
}

/**
 * Get total npm downloads.
 */
async function getTotalDownloads(): Promise<number | undefined> {
  return cacheTotalDownloads.total;
}

/**
 * Get download stats for a list of packages.
 */
async function fetchDownload(
  pkgNames: string,
  retry: number = 0
): Promise<Record<string, { packageNpmDownloads?: number }>> {
  const start = Date.now();

  try {
    const response = await downloadsQueue.add(() => {
      datadog.increment('npm.downloads.requests');

      return request<PackageDownload | Record<string, PackageDownload | null>>(
        `${config.npmDownloadsEndpoint}/point/last-month/${pkgNames}`,
        {
          responseType: 'json',
        }
      );
    });

    if (response.statusCode !== 200 || !response.body) {
      return {};
    }

    // Single package
    if (response.body.downloads) {
      return {
        [response.body.package as string]: {
          packageNpmDownloads: response.body?.downloads as number,
        },
      };
    }

    return _.mapValues(response.body, (record) => {
      return {
        packageNpmDownloads:
          (typeof record === 'object' && record?.downloads) || undefined,
      };
    });
  } catch (error) {
    if (
      error instanceof HTTPError &&
      (error.response.statusCode === 429 || error.response.statusCode >= 500)
    ) {
      datadog.increment(`npm.downloads.throttle`);

      if (!downloadsQueue.isPaused) {
        downloadsQueue.pause();
        setTimeout(() => downloadsQueue.start(), ms('1 minute')).unref();
      }

      if (retry < config.retryMax) {
        return fetchDownload(pkgNames, retry + 1);
      }
    }

    if (error instanceof HTTPError && error.response.statusCode === 404) {
      return {};
    }

    datadog.increment(`npm.downloads.failure`);
    log.warn(`An error occurred when getting download of ${pkgNames} ${error}`);
    throw error;
  } finally {
    datadog.timing('npm.fetchDownload', Date.now() - start);
  }
}

export function computeDownload(
  pkg: Pick<RawPkg, 'name'>,
  downloadsLast30Days: number | undefined,
  totalNpmDownloads: number | undefined
): GetDownload | null {
  if (!downloadsLast30Days || !totalNpmDownloads) {
    return null;
  }

  const downloadsRatio = Number(
    ((downloadsLast30Days / totalNpmDownloads) * 100).toFixed(4)
  );
  const popular = downloadsRatio > config.popularDownloadsRatio;
  const downloadsMagnitude = downloadsLast30Days
    ? downloadsLast30Days.toString().length
    : 0;

  return {
    downloadsLast30Days,
    humanDownloadsLast30Days: numeral(downloadsLast30Days).format('0.[0]a'),
    downloadsRatio,
    popular,
    _downloadsMagnitude: downloadsMagnitude,
    // if the package is popular, we copy its name to a dedicated attribute
    // which will make popular records' `name` matches to be ranked higher than other matches
    // see the `searchableAttributes` index setting
    ...(popular && {
      _popularName: pkg.name,
    }),
  };
}

/**
 * Get downloads for all packages passer in arguments.
 */
async function getDownloads(
  pkgs: Array<Pick<RawPkg, 'name'>>
): Promise<Record<string, DownloadsData>> {
  const start = Date.now();

  if (pkgs.length > 1 && pkgs.some((pkg) => pkg.name.startsWith('@'))) {
    throw new Error(
      `Scoped packages can only be requested separately, one at a time.`
    );
  }

  const encodedPackageNames = pkgs
    .map((pkg) => pkg.name)
    .map((name) => encodeURIComponent(name));

  if (encodedPackageNames.length > 1) {
    // why do we do this? see https://github.com/npm/registry/issues/104
    encodedPackageNames.unshift('');
  }

  const totalNpmDownloads = await getTotalDownloads();
  const packageNpmDownloads = await fetchDownload(
    encodedPackageNames.join(',')
  );

  datadog.timing('npm.getDownloads', Date.now() - start);

  return _.mapValues(
    _.pickBy(packageNpmDownloads, (value, key) => key),
    (pkg) => {
      return { ...pkg, totalNpmDownloads };
    }
  );
}

export {
  findAll,
  loadTotalDownloads,
  getInfo,
  getDoc,
  getDocFromRegistry,
  getDependents,
  getDependent,
  fetchDownload,
  getDownloads,
};

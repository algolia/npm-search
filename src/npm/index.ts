import chunk from 'lodash/chunk';
import type {
  DatabaseChangesParams,
  DatabaseChangesResponse,
  DocumentFetchResponse,
  DocumentListParams,
  DocumentListResponse,
  DocumentScopeFollowUpdatesParams,
} from 'nano';
import nano from 'nano';
import numeral from 'numeral';

import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
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
  _searchInternal: {
    expiresAt?: string;
    popularName?: string;
    downloadsMagnitude: number;
  };
};
let cacheTotalDownloads: { total: number; date: number } | undefined;

const registry = nano({
  url: config.npmRegistryEndpoint,
  requestDefaults: {
    agent: httpsAgent,
    headers: {
      'user-agent': USER_AGENT,
    },
  },
});
const db = registry.use<GetPackage>(config.npmRegistryDBName);

// Default request options
const defaultOptions: DatabaseChangesParams = {
  include_docs: true,
  conflicts: false,
  attachments: false,
};

/**
 * Find all packages in registry.
 */
async function findAll(
  options: Partial<DocumentListParams>
): Promise<DocumentListResponse<GetPackage>> {
  const start = Date.now();

  const results = await db.list({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.allDocs', Date.now() - start);

  return results;
}

async function getChanges(
  options: Partial<DatabaseChangesParams>
): Promise<DatabaseChangesResponse> {
  const start = Date.now();

  const results = await db.changes({
    ...defaultOptions,
    ...options,
  });

  datadog.timing('db.getChanges', Date.now() - start);

  return results;
}

async function getDocs({
  keys,
}: {
  keys: string[];
}): Promise<DocumentFetchResponse<GetPackage>> {
  const start = Date.now();

  const docs = await db.fetch({ keys });

  datadog.timing('npm.getDocs', Date.now() - start);

  return docs;
}

/**
 * Listen to changes in registry.
 *
 * @param options - Options param.
 */
function listenToChanges(
  options: DocumentScopeFollowUpdatesParams
): nano.FollowEmitter {
  const listener = db.follow({
    ...defaultOptions,
    ...(options as any), // there is an incompat between types but they are compat
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
 * Validate if a package exists.
 */
async function validatePackageExists(pkgName: string): Promise<boolean> {
  const start = Date.now();

  let exists: boolean;
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

/**
 * Get total npm downloads.
 */
async function getTotalDownloads(): Promise<number> {
  const start = Date.now();

  if (
    cacheTotalDownloads &&
    Date.now() - cacheTotalDownloads.date < config.cacheTotalDownloads
  ) {
    return cacheTotalDownloads.total;
  }

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
  cacheTotalDownloads = {
    date: start,
    total,
  };

  datadog.timing('npm.getTotalDownloads', Date.now() - start);

  return total;
}

/**
 * Get download stats for a list of packages.
 */
async function fetchDownload(
  pkgNames: string
): Promise<{ body: Record<string, PackageDownload | null> }> {
  const start = Date.now();

  try {
    const response = await request<
      Record<string, PackageDownload | null> | (PackageDownload | null)
    >(`${config.npmDownloadsEndpoint}/point/last-month/${pkgNames}`, {
      responseType: 'json',
    });
    if (response.statusCode !== 200 || !response.body) {
      return { body: {} };
    }

    // Single package
    if (response.body.downloads) {
      return {
        body: {
          [response.body.package as string]: response.body as PackageDownload,
        },
      };
    }
    return response as { body: Record<string, PackageDownload | null> };
  } catch (error) {
    log.warn(`An error ocurred when getting download of ${pkgNames} ${error}`);
    return { body: {} };
  } finally {
    datadog.timing('npm.fetchDownload', Date.now() - start);
  }
}

function computeDownload(
  pkg: Pick<RawPkg, 'name'>,
  downloads: PackageDownload | null,
  totalNpmDownloads: number
): GetDownload | null {
  if (!downloads) {
    return null;
  }

  const downloadsLast30Days = downloads.downloads;
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
    _searchInternal: {
      // if the package is popular, we copy its name to a dedicated attribute
      // which will make popular records' `name` matches to be ranked higher than other matches
      // see the `searchableAttributes` index setting
      ...(popular && {
        popularName: pkg.name,
        expiresAt: new Date(Date.now() + config.popularExpiresAt)
          .toISOString()
          .split('T')[0],
      }),
      downloadsMagnitude,
    },
  };
}

/**
 * Get downloads for all packages passer in arguments.
 */
async function getDownloads(
  pkgs: Array<Pick<RawPkg, 'name'>>
): Promise<Array<GetDownload | null>> {
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
    ...pkgsNamesChunks.map(fetchDownload),
    ...encodedScopedPackageNames.map(fetchDownload),
  ]);

  const downloadsPerPkgName: Record<string, PackageDownload> =
    downloadsPerPkgNameChunks.reduce(
      (res, { body: downloadsPerPkgNameChunk }) => ({
        ...res,
        ...downloadsPerPkgNameChunk,
      }),
      {}
    );

  const all = pkgs.map((pkg) => {
    return computeDownload(
      pkg,
      downloadsPerPkgName[pkg.name],
      totalNpmDownloads
    );
  });

  datadog.timing('npm.getDownloads', Date.now() - start);
  return all;
}

async function getDownload(
  pkg: Pick<RawPkg, 'name'>
): Promise<GetDownload | null> {
  const start = Date.now();

  try {
    const name = encodeURIComponent(pkg.name);
    const totalNpmDownloads = await getTotalDownloads();
    const downloads = await fetchDownload(name);
    return computeDownload(pkg, downloads.body[pkg.name], totalNpmDownloads);
  } finally {
    datadog.timing('npm.getDownload', Date.now() - start);
  }
}

export {
  findAll,
  listenToChanges,
  getChanges,
  getInfo,
  getDocs,
  validatePackageExists,
  getDependents,
  getDependent,
  getDownload,
  fetchDownload,
  getDownloads,
};

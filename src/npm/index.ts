import chunk from 'lodash/chunk';
import type {
  DocumentGetResponse,
  DocumentListParams,
  DocumentListResponse,
} from 'nano';
import nano from 'nano';
import numeral from 'numeral';

import type { FinalPkg, RawPkg } from '../@types/pkg';
import { config } from '../config';
import { datadog } from '../utils/datadog';
import { getExpiresAt } from '../utils/getExpiresAt';
import { log } from '../utils/log';
import { httpsAgent, request, USER_AGENT } from '../utils/request';

import type { GetInfo, GetPackage, PackageDownload } from './types';

type GetDependent = { dependents: number; humanDependents: string };
type GetDownload = {
  downloadsLast30Days: number;
  humanDownloadsLast30Days: string;
  downloadsRatio: number;
  popular: boolean;
  _searchInternal: Pick<
    FinalPkg['_searchInternal'],
    'downloadsMagnitude' | 'expiresAt' | 'popularName'
  >;
};
let cacheTotalDownloads: { total: number; date: number } | undefined;

const registry = nano({
  url: config.npmRegistryEndpoint,
  requestDefaults: {
    agent: httpsAgent,
    timeout: 15000,
    headers: {
      'user-agent': USER_AGENT,
      'Accept-Encoding': 'deflate, gzip',
      'content-type': 'application/json',
      accept: 'application/json',
    },
  },
});

export const db = registry.use<GetPackage>(config.npmRegistryDBName);

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

  const doc = await db.get(name, { rev });

  datadog.timing('npm.getDoc', Date.now() - start);

  return doc;
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

// /**
//  * Get a package version.
//  *
//  * Doc: https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md.
//  */
// async function getPackageLight(pkgName: string): Promise<GetPackageLight> {
//   const start = Date.now();

//   const { body } = await request<GetPackageLight>(
//     `${config.npmRootEndpoint}/${pkgName}`,
//     {
//       method: 'GET',
//       headers: {
//         Accept: 'application/vnd.npm.install-v1+json',
//       },
//       responseType: 'json',
//     }
//   );

//   datadog.timing('npm.getPackageLight', Date.now() - start);
//   return body;
// }

// /**
//  * Get a package version.
//  */
// async function getPackageAtVersion(
//   pkgName: string,
//   version: string
// ): Promise<GetVersion> {
//   const start = Date.now();

//   const { body } = await request<GetVersion>(
//     `${config.npmRootEndpoint}/${pkgName}/${version}`,
//     {
//       method: 'GET',
//       responseType: 'json',
//     }
//   );

//   datadog.timing('npm.getPackageLight', Date.now() - start);
//   return body;
// }

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
      expiresAt: getExpiresAt(popular),
      downloadsMagnitude,
      // if the package is popular, we copy its name to a dedicated attribute
      // which will make popular records' `name` matches to be ranked higher than other matches
      // see the `searchableAttributes` index setting
      ...(popular && {
        popularName: pkg.name,
      }),
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
      downloadsPerPkgName[pkg.name]!,
      totalNpmDownloads
    );
  });

  datadog.timing('npm.getDownloads', Date.now() - start);
  return all;
}

// eslint-disable-next-line require-await
async function getDownload(
  pkg: Pick<RawPkg, 'name'>
): Promise<GetDownload | null> {
  const start = Date.now();

  try {
    // const name = encodeURIComponent(pkg.name);
    // const totalNpmDownloads = await getTotalDownloads();
    // const downloads = await fetchDownload(name);
    return computeDownload(pkg, { downloads: 0 }, 0);
  } finally {
    datadog.timing('npm.getDownload', Date.now() - start);
  }
}

export {
  findAll,
  getInfo,
  getDoc,
  getDependents,
  getDependent,
  getDownload,
  fetchDownload,
  getDownloads,
};

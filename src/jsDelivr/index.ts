import { HTTPError } from 'got/dist/source';

import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import { request } from '../utils/request';
import * as sentry from '../utils/sentry';

type Hit = { type: 'npm'; name: string; hits: number };
export type File = { name: string; hash: string; time: string; size: number };
export type GetHit = {
  popular: boolean;
  jsDelivrHits: number;
  _jsDelivrPopularity: number;
  _popularName?: string;
};
export const hits = new Map<string, { hits: number; popular: boolean }>();

/**
 * Load downloads hits.
 */
export async function loadHits(): Promise<void> {
  const start = Date.now();
  log.info('📦  Loading hits from jsDelivr');

  const res = await request<Hit[]>(config.jsDelivrHitsEndpoint, {
    responseType: 'json',
  });

  if (!res.body.length) {
    throw new Error('Empty jsDelivr data');
  }

  hits.clear();

  res.body.forEach((pkg, index) => {
    hits.set(pkg.name, { hits: pkg.hits, popular: index < 1000 });
  });

  datadog.timing('jsdelivr.loadHits', Date.now() - start);
}

/**
 * Get download hits.
 */
export function getHits(pkgs: Array<Pick<RawPkg, 'name'>>): GetHit[] {
  const start = Date.now();
  const all = pkgs.map(getHit);

  datadog.timing('jsdelivr.getHits', Date.now() - start);
  return all;
}

export function getHit(pkg: Pick<RawPkg, 'name'>): GetHit {
  const data = hits.get(pkg.name);
  const jsDelivrHits = data?.hits || 0;
  const popular = data?.popular || false;

  return {
    popular,
    jsDelivrHits,
    // anything below 1000 hits/month is likely to mean that
    // someone just made a few random requests so we count that as 0
    _jsDelivrPopularity: Math.max(jsDelivrHits.toString().length - 3, 0),
    // similar to npm popular but we consider the top 1k packages instead
    ...(popular && {
      _popularName: pkg.name,
    }),
  };
}

/**
 * Get one package files list.
 */
export async function getFilesList(
  pkg: Pick<RawPkg, 'name' | 'version'>
): Promise<File[]> {
  const start = Date.now();
  if (!pkg.name || !pkg.version) {
    throw new Error(
      `Package name should contain a version number: ${pkg.name}`
    );
  }

  let files: File[] = [];
  const url = `${config.jsDelivrPackageEndpoint}/${pkg.name}@${pkg.version}/flat`;
  try {
    const response = await request<{ default: string; files: File[] }>(url, {
      responseType: 'json',
    });

    if (Array.isArray(response.body.files)) {
      files = response.body.files;
    } else {
      sentry.report(new Error('JsDelivr network error'), {
        statusCode: response.statusCode,
        files: response.body.files,
        url,
      });
    }
  } catch (err: any) {
    if (
      !(
        err instanceof HTTPError && [403, 404].includes(err.response.statusCode)
      )
    ) {
      sentry.report(new Error('JsDelivr network error'), {
        statusCode: err?.response?.statusCode,
        err,
        url,
      });
    }
  }

  datadog.timing('jsdelivr.getFilesList', Date.now() - start);
  return files;
}

export function getFullURL(
  pkg: Pick<RawPkg, 'name' | 'version'>,
  file: File
): string {
  return `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version}${file.name}`;
}

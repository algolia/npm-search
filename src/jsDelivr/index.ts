import type { RawPkg } from '../@types/pkg';
import { config } from '../config';
import { datadog } from '../utils/datadog';
import { log } from '../utils/log';
import { request } from '../utils/request';

type Hit = { type: 'npm'; name: string; hits: number };
type File = { name: string; hash: string; time: string; size: number };
const hits = new Map<string, number>();

/**
 * Load downloads hits.
 */
async function loadHits(): Promise<void> {
  const start = Date.now();
  log.info('📦  Loading hits from jsDelivr');

  try {
    const res = await request<Hit[]>(config.jsDelivrHitsEndpoint, {
      responseType: 'json',
    });

    hits.clear();
    res.body.forEach((pkg) => {
      hits.set(pkg.name, pkg.hits);
    });
  } catch (e) {
    log.error(e);
  }

  datadog.timing('jsdelivr.loadHits', Date.now() - start);
}

/**
 * Get download hits.
 */
function getHits(pkgs: Array<Pick<RawPkg, 'name'>>): Array<{
  jsDelivrHits: number;
  _searchInternal: { jsDelivrPopularity: number };
}> {
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
 * Get packages files list.
 */
async function getAllFilesList(
  pkgs: Array<Pick<RawPkg, 'name' | 'version'>>
): Promise<File[][]> {
  const start = Date.now();

  const files = await Promise.all(pkgs.map(getFilesList));

  datadog.timing('jsdelivr.getAllFilesList', Date.now() - start);
  return files;
}

/**
 * Get one package files list.
 */
async function getFilesList(
  pkg: Pick<RawPkg, 'name' | 'version'>
): Promise<File[]> {
  const start = Date.now();
  if (!pkg.name || !pkg.version) {
    throw new Error(
      `Package name should contain a version number: ${pkg.name}`
    );
  }

  let files: File[] = [];
  try {
    const response = await request<{ default: string; files: File[] }>(
      `${config.jsDelivrPackageEndpoint}/${pkg.name}@${pkg.version}/flat`,
      {
        responseType: 'json',
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

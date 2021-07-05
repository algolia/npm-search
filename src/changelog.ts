import path from 'path';

import race from 'promise-rat-race';

import type { RawPkg, Repo } from './@types/pkg';
import { config } from './config';
import * as jsDelivr from './jsDelivr/index';
import { datadog } from './utils/datadog';
import { request } from './utils/request';

export const baseUrlMap = new Map<
  string,
  (opts: Pick<Repo, 'user' | 'project' | 'path' | 'branch'>) => string
>();
baseUrlMap.set(
  'github.com',
  ({ user, project, path: pathName, branch }): string => {
    return `https://raw.githubusercontent.com/${user}/${project}/${
      pathName ? '' : branch
    }${`${pathName.replace('/tree/', '')}`}`;
  }
);
baseUrlMap.set(
  'gitlab.com',
  ({ user, project, path: pathName, branch }): string => {
    return `https://gitlab.com/${user}/${project}${
      pathName ? pathName.replace('tree', 'raw') : `/raw/${branch}`
    }`;
  }
);
baseUrlMap.set(
  'bitbucket.org',
  ({ user, project, path: pathName, branch }): string => {
    return `https://bitbucket.org/${user}/${project}${
      pathName ? pathName.replace('src', 'raw') : `/raw/${branch}`
    }`;
  }
);

const fileOptions = [
  'CHANGELOG.md',
  'ChangeLog.md',
  'changelog.md',
  'changelog.markdown',
  'CHANGELOG',
  'ChangeLog',
  'changelog',
  'CHANGES.md',
  'changes.md',
  'Changes.md',
  'CHANGES',
  'changes',
  'Changes',
  'HISTORY.md',
  'history.md',
  'HISTORY',
  'history',
  'RELEASES.md',
  'RELEASES',
];

// https://regex101.com/r/zU2gjr/1
const fileRegex =
  /^(((changelogs?)|changes|history|(releases?)))((.(md|markdown))?$)/i;

async function handledGot(file: string): Promise<string> {
  const result = await request(file, { method: 'HEAD' });

  if (
    // bitbucket returns 200 for private repos
    // github returns a 404
    // I am unsure what gitlab does
    result?.redirectUrls?.find((res) =>
      res.startsWith('https://bitbucket.org/account/signin')
    )
  ) {
    throw new Error('Redirect leads to login page');
  }
  if (result.statusCode !== 200) {
    throw new Error('not found');
  }

  return result.url;
}

async function raceFromPaths(files: string[]): Promise<{
  changelogFilename: string | null;
}> {
  try {
    const url = await race(files.map((file) => handledGot(file)));
    return { changelogFilename: url };
  } catch (e) {
    return { changelogFilename: null };
  }
}

export async function getChangelog(
  pkg: Pick<RawPkg, 'repository' | 'name' | 'version'>
): Promise<{
  changelogFilename: string | null;
}> {
  // Do a quick call to jsDelivr
  // Only work if the package has published their changelog along with the code
  const filesList = await jsDelivr.getFilesList(pkg);
  for (const file of filesList) {
    const name = path.basename(file.name);
    if (!fileRegex.test(name)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    return { changelogFilename: jsDelivr.getFullURL(pkg, file) };
  }

  const { repository, name, version } = pkg;

  // Rollback to brut-force
  const unpkgFiles = fileOptions.map(
    (file) => `${config.unpkgRoot}/${name}@${version}/${file}`
  );

  if (repository === null) {
    return raceFromPaths(unpkgFiles);
  }

  const user = repository.user || '';
  const project = repository.project || '';
  const host = repository.host || '';
  if (user.length < 1 || project.length < 1) {
    return raceFromPaths(unpkgFiles);
  }

  // Check if we know how to handle this host
  if (!baseUrlMap.has(host)) {
    return raceFromPaths(unpkgFiles);
  }

  const baseUrl = baseUrlMap.get(host)!(repository);

  const files = fileOptions.map((file) =>
    [baseUrl.replace(/\/$/, ''), file].join('/')
  );

  return raceFromPaths([...files, ...unpkgFiles]);
}

export async function getChangelogs(
  pkgs: Array<Pick<RawPkg, 'repository' | 'name' | 'version'>>
): Promise<
  Array<{
    changelogFilename: string | null;
  }>
> {
  const start = Date.now();

  const all = await Promise.all(pkgs.map(getChangelog));

  datadog.timing('changelogs.getChangelogs', Date.now() - start);
  return all;
}

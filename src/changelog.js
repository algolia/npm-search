import got from 'got';
import race from 'promise-rat-race';

import datadog from './datadog.js';
import config from './config.js';

export const baseUrlMap = new Map([
  [
    'github.com',
    ({ user, project, path, branch }) =>
      `https://raw.githubusercontent.com/${user}/${project}/${
        path ? '' : branch
      }${`${path.replace('/tree/', '')}`}`,
  ],
  [
    'gitlab.com',
    ({ user, project, path, branch }) =>
      `https://gitlab.com/${user}/${project}${
        path ? path.replace('tree', 'raw') : `/raw/${branch}`
      }`,
  ],
  [
    'bitbucket.org',
    ({ user, project, path, branch }) =>
      `https://bitbucket.org/${user}/${project}${
        path ? path.replace('src', 'raw') : `/raw/${branch}`
      }`,
  ],
]);

async function raceFromPaths(files) {
  try {
    const { url } = await race(
      files.map(file => got(file, { method: 'HEAD' }))
    );
    return { changelogFilename: url };
  } catch (e) {
    return { changelogFilename: null };
  }
}

function getChangelog({ repository, name, version }) {
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
  ];

  const unpkgFiles = fileOptions.map(
    file => `${config.unpkgRoot}/${name}@${version}/${file}`
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

  const baseUrl = baseUrlMap.get(host)(repository);

  const files = fileOptions.map(file =>
    [baseUrl.replace(/\/$/, ''), file].join('/')
  );

  return raceFromPaths([...files, ...unpkgFiles]);
}

export async function getChangelogs(pkgs) {
  const start = Date.now();

  const all = await Promise.all(pkgs.map(getChangelog));

  datadog.timing('changelogs.getChangelogs', Date.now() - start);
  return all;
}

import got from 'got';
import race from 'promise-rat-race';

import datadog from './datadog.js';
import { gotUnpkg } from './unpkg.js';

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

async function getChangelog({ repository, name, version }) {
  if (repository === null) {
    return { changelogFilename: null };
  }

  const user = repository.user || '';
  const project = repository.project || '';
  const host = repository.host || '';
  if (user.length < 1 || project.length < 1) {
    return { changelogFilename: null };
  }

  // Check if we know how to handle this host
  if (!baseUrlMap.has(host)) {
    return { changelogFilename: null };
  }

  const baseUrl = baseUrlMap.get(host)(repository);

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

  const files = fileOptions.map(file =>
    [baseUrl.replace(/\/$/, ''), file].join('/')
  );

  try {
    const { url } = await race([
      ...files.map(got, { method: 'HEAD' }),
      ...fileOptions.map(file => gotUnpkg(name, version, file)),
    ]);
    return { changelogFilename: url };
  } catch (e) {
    return { changelogFilename: null };
  }
}

export async function getChangelogs(pkgs) {
  const start = Date.now();

  const all = await Promise.all(pkgs.map(getChangelog));

  datadog.timing('changelogs.getChangelogs', Date.now() - start);
  return all;
}

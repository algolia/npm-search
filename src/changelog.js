import got from 'got';
import race from 'promise-rat-race';

const baseUrlMap = new Map([
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

function getChangelog({ repository }) {
  if (repository === null) {
    return { changelogFilename: null };
  }

  const { user = '', project = '', host = '' } = repository;
  if (user.length < 1 || project.length < 1) {
    return { changelogFilename: null };
  }

  // Check if we know how to handle this host
  if (!baseUrlMap.has(host)) {
    return { changelogFilename: null };
  }

  const baseUrl = baseUrlMap.get(host)(repository);

  const files = [
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
  ].map(file => [baseUrl.replace(/\/$/, ''), file].join('/'));

  return race(files.map(got, { method: 'HEAD' }))
    .then(({ url }) => ({ changelogFilename: url }))
    .catch(() => ({ changelogFilename: null }));
}

export function getChangelogs(pkgs) {
  return Promise.all(pkgs.map(getChangelog));
}

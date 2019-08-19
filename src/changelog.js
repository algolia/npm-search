import got from 'got';
import race from 'promise-rat-race';

import config from './config.js';
import datadog from './datadog.js';

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

async function getChangelog({ repository }) {
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

  try {
    const { url } = await race(files.map(got, { method: 'HEAD' }));
    return { changelogFilename: url };
  } catch (e) {
    return { changelogFilename: null };
  }
}

const CHANGELOG_REGEX = new RegExp(
  /^(?:(?:update|change|release)(?:s|[ \-_]*(?:logs?|histor(?:y|ies)))|histor(?:y|ies)|release[ \-_]*notes?)(?:\.[\da-z]+)?$/i
);

function checkChangelogFromFilesList(pkg, filesList) {
  // Check in fileList
  if (!filesList || filesList.length <= 0) {
    return false;
  }

  const match = filesList.find(file => CHANGELOG_REGEX.test(file.name));
  if (match) {
    const url = `${config.jsDelivrCDN}/${pkg.name}@${pkg.version}/${match.name}`;
    return { changelogFilename: url };
  }

  return false;
}

export async function getChangelogs(pkgs, filesLists) {
  const start = Date.now();

  const all = await Promise.all(
    pkgs.map((pkg, index) => {
      const fromFS = checkChangelogFromFilesList(pkg, filesLists[index]);
      if (fromFS) {
        return fromFS;
      }

      return getChangelog(pkg);
    })
  );

  datadog.timing('changelogs.getChangelogs', Date.now() - start);
  return all;
}

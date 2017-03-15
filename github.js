import got from 'got';
import race from 'promise-rat-race';

function getChangelog(
  {
    githubRepo = {
      user: '',
      project: '',
      path: '',
    },
    gitHead = 'master',
  },
) {
  if (githubRepo === null) {
    return {changelogFilename: null};
  }

  const {user, project, path} = githubRepo;
  if (user.length < 1 || project.length < 1) {
    return {changelogFilename: null};
  }

  const baseGithubURL = `https://raw.githubusercontent.com/${user}/${project}/${gitHead}/${`${path.replace('/tree/', '')}`}`;
  const files = [
    'CHANGELOG.md',
    'ChangeLog.md',
    'changelog.md',
    'CHANGELOG',
    'ChangeLog',
    'changelog',
    'HISTORY.md',
    'history.md',
    'HISTORY',
    'history',
  ].map(file => [baseGithubURL.replace(/\/$/, ''), file].join('/'));

  return race(files.map(got, {method: 'HEAD'}))
    .then(({url}) => ({changelogFilename: url}))
    .catch(() => ({changelogFilename: null}));
}

export function getChangelogs(pkgs) {
  return Promise.all(pkgs.map(getChangelog));
}

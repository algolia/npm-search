import got from 'got';

function properPromiseRace(promises) {
  if (promises.length < 1) {
    return Promise.reject("Can't start a race without promises!");
  }

  // There is no way to know which promise is rejected.
  // So we map it to a new promise to return the index when it fails
  const indexPromises = promises.map((p, index) =>
    p.catch(() => {
      throw index;
    }));

  return Promise.race(indexPromises).catch(index => {
    // The promise has rejected, remove it from the list of promises and just continue the race.
    const p = promises.splice(index, 1)[0];
    p.catch(() => {});
    return properPromiseRace(promises);
  });
}

function getChangelog(
  {
    githubRepo: {
      user,
      project,
      path,
    },
    gitHead,
  },
) {
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

  return properPromiseRace(files.map(got, {method: 'HEAD'}))
    .then(({url}) => ({changelogFilename: url}))
    .catch(() => ({changelogFilename: undefined}));
}

export function getChangelogs(pkgs) {
  return Promise.all(pkgs.map(getChangelog));
}

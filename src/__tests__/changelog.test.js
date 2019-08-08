import { getChangelogs, baseUrlMap } from '../changelog.js';

jest.mock('got', () => {
  const gotSnapshotUrls = new Set([
    'https://gitlab.com/janslow/gitlab-fetch/raw/master/CHANGELOG.md',
    'https://raw.githubusercontent.com/visionmedia/debug/master/CHANGELOG.md',
    'https://bitbucket.org/atlassian/aui/raw/master/changelog.md',
    'https://raw.githubusercontent.com/expressjs/body-parser/master/HISTORY.md',
  ]);

  return url =>
    gotSnapshotUrls.has(url) ? Promise.resolve({ url }) : Promise.reject(); // eslint-disable-line prefer-promise-reject-errors
});

describe('should test baseUrlMap', () => {
  it('should work with paths', () => {
    const bitbucketRepo = {
      host: 'bitbucket.org',
      user: 'user',
      project: 'project',
      path: '/src/master/packages/project1',
      head: 'master',
      branch: 'master',
    };

    const gitlabRepo = {
      host: 'gitlab.com',
      path: '/tree/master/foo/bar',
      project: 'project',
      user: 'user',
    };

    const githubRepo = {
      host: 'github.com',
      user: 'babel',
      project: 'babel',
      path: '/tree/master/packages/babel-core',
      head: 'master',
    };

    expect(baseUrlMap.get('bitbucket.org')(bitbucketRepo)).toBe(
      'https://bitbucket.org/user/project/raw/master/packages/project1'
    );

    expect(baseUrlMap.get('gitlab.com')(gitlabRepo)).toBe(
      'https://gitlab.com/user/project/raw/master/foo/bar'
    );

    expect(baseUrlMap.get('github.com')(githubRepo)).toBe(
      'https://raw.githubusercontent.com/babel/babel/master/packages/babel-core'
    );
  });

  it('should work without paths', () => {
    const bitbucketRepo = {
      host: 'bitbucket.org',
      user: 'user',
      path: '',
      project: 'project',
      branch: 'master',
    };

    const gitlabRepo = {
      host: 'gitlab.com',
      project: 'project',
      path: '',
      user: 'user',
      branch: 'master',
    };

    const githubRepo = {
      host: 'github.com',
      user: 'babel',
      project: 'babel',
      path: '',
      branch: 'master',
    };

    expect(baseUrlMap.get('bitbucket.org')(bitbucketRepo)).toBe(
      'https://bitbucket.org/user/project/raw/master'
    );

    expect(baseUrlMap.get('gitlab.com')(gitlabRepo)).toBe(
      'https://gitlab.com/user/project/raw/master'
    );

    expect(baseUrlMap.get('github.com')(githubRepo)).toBe(
      'https://raw.githubusercontent.com/babel/babel/master'
    );
  });
});

it('should get changelog for github', async () => {
  const pkg = {
    repository: {
      host: 'github.com',
      user: 'visionmedia',
      project: 'debug',
      path: '',
      head: 'master',
      branch: 'master',
    },
  };

  const [{ changelogFilename }] = await getChangelogs([pkg]);
  expect(changelogFilename).toBe(
    'https://raw.githubusercontent.com/visionmedia/debug/master/CHANGELOG.md'
  );
});

it('should get changelog for gitlab', async () => {
  const pkg = {
    repository: {
      host: 'gitlab.com',
      user: 'janslow',
      project: 'gitlab-fetch',
      path: '',
      head: 'master',
      branch: 'master',
    },
  };

  const [{ changelogFilename }] = await getChangelogs([pkg]);
  expect(changelogFilename).toBe(
    'https://gitlab.com/janslow/gitlab-fetch/raw/master/CHANGELOG.md'
  );
});

it('should get changelog for bitbucket', async () => {
  const pkg = {
    repository: {
      host: 'bitbucket.org',
      user: 'atlassian',
      project: 'aui',
      path: '',
      head: 'master',
      branch: 'master',
    },
  };

  const [{ changelogFilename }] = await getChangelogs([pkg]);
  expect(changelogFilename).toBe(
    'https://bitbucket.org/atlassian/aui/raw/master/changelog.md'
  );
});

it('should work with HISTORY.md', async () => {
  const pkg = {
    repository: {
      host: 'github.com',
      user: 'expressjs',
      project: 'body-parser',
      path: '',
      head: 'master',
      branch: 'master',
    },
  };

  const [{ changelogFilename }] = await getChangelogs([pkg]);
  expect(changelogFilename).toBe(
    'https://raw.githubusercontent.com/expressjs/body-parser/master/HISTORY.md'
  );
});

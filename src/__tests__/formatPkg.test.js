import formatPkg from '../formatPkg';
import rawPackages from './rawPackages.json';
import isISO8601 from 'validator/lib/isISO8601';

it('transforms correctly', () => {
  const transformed = rawPackages.map(formatPkg).map(element => {
    expect(isISO8601(element.lastCrawl)).toBe(true);
    // eslint-disable-next-line no-param-reassign
    element.lastCrawl = '<!-- date replaced -->';
    return element;
  });
  expect(transformed).toMatchSnapshot();
});

it('truncates long readmes', () => {
  const object = {
    name: 'long-boy',
    lastPublisher: { name: 'unknown' },
    readme: 'Hello, World! '.repeat(40000),
  };
  const formatted = formatPkg(object);
  const truncatedEnding = '**TRUNCATED**';
  const ending = formatted.readme.substr(
    formatted.readme.length - truncatedEnding.length
  );

  expect(formatted.readme).toHaveLength(451070);
  expect(ending).toBe(truncatedEnding);

  formatted.lastCrawl = '<!-- date replaced -->';
  expect(formatted).toMatchSnapshot();
});

describe('adds babel plugins', () => {
  const dogs = {
    name: '@babel/plugin-dogs',
    lastPublisher: { name: 'xtuc' },
  };
  const unofficialDogs = {
    name: 'babel-plugin-dogs',
    lastPublisher: { name: 'unknown' },
  };

  const formattedDogs = formatPkg(dogs);
  const formattedUnofficialDogs = formatPkg(unofficialDogs);

  expect(formattedDogs.keywords).toEqual(['babel-plugin']);
  expect(formattedUnofficialDogs.keywords).toEqual(['babel-plugin']);
});

describe('adds vue-cli plugins', () => {
  const dogs = {
    name: '@vue/cli-plugin-dogs',
    lastPublisher: { name: 'xtuc' },
  };
  const unofficialDogs = {
    name: 'vue-cli-plugin-dogs',
    lastPublisher: { name: 'unknown' },
  };
  const scopedDogs = {
    name: '@dogs/vue-cli-plugin-dogs',
    lastPublisher: { name: 'unknown' },
  };

  const formattedDogs = formatPkg(dogs);
  const formattedUnofficialDogs = formatPkg(unofficialDogs);
  const formattedScopedDogs = formatPkg(scopedDogs);

  expect(formattedDogs.keywords).toEqual(['vue-cli-plugin']);
  expect(formattedUnofficialDogs.keywords).toEqual(['vue-cli-plugin']);
  expect(formattedScopedDogs.keywords).toEqual(['vue-cli-plugin']);
});

describe('test getRepositoryInfo', () => {
  const getRepositoryInfo = formatPkg.__RewireAPI__.__get__(
    'getRepositoryInfo'
  );

  it('should get information from short repository url', () => {
    expect(getRepositoryInfo('gitlab:user/repo')).toEqual({
      host: 'gitlab.com',
      user: 'user',
      project: 'repo',
      path: '',
    });

    expect(getRepositoryInfo('github:user/repo')).toEqual({
      host: 'github.com',
      user: 'user',
      project: 'repo',
      path: '',
    });

    expect(getRepositoryInfo('bitbucket:user/repo')).toEqual({
      host: 'bitbucket.org',
      user: 'user',
      project: 'repo',
      path: '',
    });
  });

  it('should get information from repository (git?+http) URLs', () => {
    expect(
      getRepositoryInfo(
        'https://github.com/babel/babel/tree/master/packages/babel'
      )
    ).toEqual({
      host: 'github.com',
      user: 'babel',
      project: 'babel',
      path: '/tree/master/packages/babel',
    });

    expect(
      getRepositoryInfo(
        'https://gitlab.com/user/repo/tree/master/packages/a-package'
      )
    ).toEqual({
      host: 'gitlab.com',
      user: 'user',
      project: 'repo',
      path: '/tree/master/packages/a-package',
    });

    expect(
      getRepositoryInfo(
        'https://bitbucket.org/user/repo/src/ae8df4cd0e809a789e3f96fd114075191c0d5c8b/packages/project1'
      )
    ).toEqual({
      host: 'bitbucket.org',
      user: 'user',
      project: 'repo',
      path: '/src/ae8df4cd0e809a789e3f96fd114075191c0d5c8b/packages/project1',
    });

    expect(
      getRepositoryInfo(
        'git+https://bitbucket.org/atlassian/confluence-web-components.git'
      )
    ).toEqual({
      host: 'bitbucket.org',
      user: 'atlassian',
      project: 'confluence-web-components',
      path: '',
    });

    expect(
      getRepositoryInfo('https://bitbucket.org/2klicdev/2klic-sdk.git')
    ).toEqual({
      host: 'bitbucket.org',
      user: '2klicdev',
      project: '2klic-sdk',
      path: '',
    });
  });

  it('should get information from repository objects', () => {
    const githubRepo = {
      type: 'git',
      url: 'https://github.com/webpack/webpack.git',
    };

    const gitlabRepo = {
      type: 'git',
      url: 'git+https://gitlab.com/hyper-expanse/semantic-release-gitlab.git',
    };

    const bitbucketRepo = {
      type: 'git',
      url: 'git+https://bitbucket.org/2klicdev/2klic-sdk.git',
    };

    expect(getRepositoryInfo(githubRepo)).toEqual({
      host: 'github.com',
      user: 'webpack',
      project: 'webpack',
      path: '',
    });

    expect(getRepositoryInfo(gitlabRepo)).toEqual({
      host: 'gitlab.com',
      user: 'hyper-expanse',
      project: 'semantic-release-gitlab',
      path: '',
    });

    expect(getRepositoryInfo(bitbucketRepo)).toEqual({
      host: 'bitbucket.org',
      user: '2klicdev',
      project: '2klic-sdk',
      path: '',
    });
  });

  it('should return null if it cannot get information', () => {
    expect(getRepositoryInfo('')).toBe(null);
    expect(getRepositoryInfo(undefined)).toBe(null);
    expect(getRepositoryInfo(null)).toBe(null);
    expect(getRepositoryInfo('aaaaaaaa')).toBe(null);
  });
});

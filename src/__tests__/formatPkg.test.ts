import NicePackage from 'nice-package';
import isISO8601 from 'validator/lib/isISO8601.js';

import formatPkg, {
  getRepositoryInfo,
  getMains,
  getVersions,
  getExportKeys,
} from '../formatPkg';
import type { GetPackage } from '../npm/types';

import preact from './preact-simplified.json';
import rawPackages from './rawPackages.json';

const BASE: GetPackage = {
  _id: '0',
  'dist-tags': {},
  _rev: '',
  name: '0',
  maintainers: [],
  readme: '',
  readmeFilename: '',
  time: {
    created: '',
    modified: '',
  },
  versions: {},
  repository: {
    type: 'git',
    url: 'https://github.com/algolia/npm-search',
  },
};

const BASE_VERSION = {
  _id: '',
  description: '',
  dist: { shasum: '', tarball: '' },
  maintainers: [],
  name: '',
  version: '',
};

describe('nice-package', () => {
  it('should nice preact', () => {
    const cleaned = new NicePackage(preact);
    expect(cleaned).toMatchSnapshot();
  });
  it('should nice atlaskit', () => {
    const pkg = rawPackages.find((p) => p.name === '@atlaskit/input');
    const cleaned = new NicePackage(pkg);
    expect(cleaned).toMatchSnapshot();
  });
});

it('transforms correctly', () => {
  rawPackages
    .map(formatPkg)
    .map((element) => {
      expect(isISO8601(element.lastCrawl)).toBe(true);
      return element;
    })
    .map((formattedPackage) =>
      expect(formattedPackage).toMatchSnapshot(
        {
          lastCrawl: expect.any(String),
          _searchInternal: {
            expiresAt: expect.any(Number),
          },
        },
        formattedPackage.objectID
      )
    );
});

it('keeps .bin intact', () => {
  const createInstantSearchApp = rawPackages.find(
    (pkg) => pkg.name === 'create-instantsearch-app'
  );
  const formatted = formatPkg(createInstantSearchApp);
  expect(formatted.bin).toMatchInlineSnapshot(`
  Object {
    "create-instantsearch-app": "src/cli/index.js",
  }
  `);
});

it('truncates long readmes', () => {
  const pkg: GetPackage = {
    ...BASE,
    name: 'long-boy',
    readme: 'Hello, World! '.repeat(40000),
  };
  const formatted = formatPkg(pkg);
  const postfix = ' **TRUNCATED**';
  const ending = formatted.readme.substr(
    formatted.readme.length - postfix.length
  );

  const readmeLength = formatted.readme.length;

  expect(readmeLength).toBeLessThan(475000);
  expect(ending).toBe(postfix);

  expect(formatted).toMatchSnapshot({
    readme: expect.any(String),
    lastCrawl: expect.any(String),
    _searchInternal: {
      expiresAt: expect.any(Number),
    },
  });
});

it('adds angular cli schematics', () => {
  const pkg: GetPackage = {
    ...BASE,
    name: 'angular-cli-schema-1',
    schematics: 'bli-blo',
    keywords: ['hi'],
  };

  const formatted = formatPkg(pkg);
  expect(formatted.keywords).toEqual(['hi']);
  expect(formatted.computedKeywords).toEqual(['angular-cli-schematic']);
  expect(formatted.computedMetadata).toEqual({
    schematics: 'bli-blo',
  });
});

it('adds babel plugins', () => {
  const pkg: GetPackage = {
    ...BASE,
    name: '@babel/plugin-dogs',
    keywords: 'babel',
  };
  const unofficialDogs = {
    ...BASE,
    name: 'babel-plugin-dogs',
    keywords: ['dogs'],
  };

  const formattedDogs = formatPkg(pkg);
  const formattedUnofficialDogs = formatPkg(unofficialDogs);

  expect(formattedDogs.keywords).toEqual(['babel']);
  expect(formattedUnofficialDogs.keywords).toEqual(['dogs']);

  expect(formattedDogs.computedKeywords).toEqual(['babel-plugin']);
  expect(formattedUnofficialDogs.computedKeywords).toEqual(['babel-plugin']);
});

describe('adds vue-cli plugins', () => {
  const pkg: GetPackage = {
    ...BASE,
    name: '@vue/cli-plugin-dogs',
  };
  const unofficialDogs = {
    ...BASE,
    name: 'vue-cli-plugin-dogs',
  };
  const scopedDogs = {
    ...BASE,
    name: '@dogs/vue-cli-plugin-dogs',
  };

  it('should format correctly', () => {
    const formattedDogs = formatPkg(pkg);
    const formattedUnofficialDogs = formatPkg(unofficialDogs);
    const formattedScopedDogs = formatPkg(scopedDogs);

    expect(formattedDogs.keywords).toEqual([]);
    expect(formattedUnofficialDogs.keywords).toEqual([]);
    expect(formattedScopedDogs.keywords).toEqual([]);

    expect(formattedDogs.computedKeywords).toEqual(['vue-cli-plugin']);
    expect(formattedUnofficialDogs.computedKeywords).toEqual([
      'vue-cli-plugin',
    ]);
    expect(formattedScopedDogs.computedKeywords).toEqual(['vue-cli-plugin']);
  });
});

describe('adds yeoman generators', () => {
  it('should add if matches the criterions', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'generator-dogs',
      keywords: ['yeoman-generator'],
    };
    const formattedDogs = formatPkg(pkg);
    expect(formattedDogs.computedKeywords).toEqual(['yeoman-generator']);
  });
  it('should not add if does not start with generator-', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'foo-dogs',
      keywords: ['yeoman-generator'],
    };
    const formattedDogs = formatPkg(pkg);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
  it('should not add if does not contain yeoman-generator as a keyword', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'generator-dogs',
      keywords: ['foo'],
    };
    const formattedDogs = formatPkg(pkg);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
});

describe('adds webpack scaffolds', () => {
  it('should add if matches the criterions', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'webpack-scaffold-cats',
    };
    const formattedDogs = formatPkg(pkg);
    expect(formattedDogs.computedKeywords).toEqual(['webpack-scaffold']);
  });
  it('should not add if does not start with generator-', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'foo-dogs',
    };
    const formattedDogs = formatPkg(pkg);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
});

describe('adds TypeScript information', () => {
  it('adds types if included in the package.json', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'xxx',
        types: './test.dts',
      })
    ).toEqual(expect.objectContaining({ types: { ts: 'included' } }));

    expect(
      formatPkg({
        ...BASE,
        name: 'xxx',
        typings: './test.dts',
      })
    ).toEqual(expect.objectContaining({ types: { ts: 'included' } }));
  });
});

describe('getRepositoryInfo', () => {
  it('should get information from short repository url', () => {
    expect(getRepositoryInfo('gitlab:user/repo')).toEqual({
      host: 'gitlab.com',
      user: 'user',
      project: 'repo',
      path: '',
      url: 'gitlab:user/repo',
    });

    expect(getRepositoryInfo('github:user/repo')).toEqual({
      host: 'github.com',
      user: 'user',
      project: 'repo',
      path: '',
      url: 'github:user/repo',
    });

    expect(getRepositoryInfo('bitbucket:user/repo')).toEqual({
      host: 'bitbucket.org',
      user: 'user',
      project: 'repo',
      path: '',
      url: 'bitbucket:user/repo',
    });
  });

  it('should get information from repository (git?+http) URLs', () => {
    expect(
      getRepositoryInfo(
        'https://github.com/babel/babel/tree/master/packages/babel'
      )
    ).toEqual({
      url: 'https://github.com/babel/babel/tree/master/packages/babel',
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
      url: 'https://gitlab.com/user/repo/tree/master/packages/a-package',
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
      url: 'https://bitbucket.org/user/repo/src/ae8df4cd0e809a789e3f96fd114075191c0d5c8b/packages/project1',
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
      url: 'git+https://bitbucket.org/atlassian/confluence-web-components.git',
    });

    expect(
      getRepositoryInfo('https://bitbucket.org/2klicdev/2klic-sdk.git')
    ).toEqual({
      host: 'bitbucket.org',
      user: '2klicdev',
      project: '2klic-sdk',
      path: '',
      url: 'https://bitbucket.org/2klicdev/2klic-sdk.git',
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

    const githubRepoWithDirectory = {
      type: 'git',
      url: 'https://github.com/facebook/react.git',
      directory: './packages/react-dom',
    };

    const githubRepoWithPathUrlAndDirectory = {
      type: 'git',
      url: 'https://github.com/facebook/react/tree/master/packages/wrong',
      directory: './packages/react-dom',
    };

    expect(getRepositoryInfo(githubRepo)).toEqual({
      host: 'github.com',
      user: 'webpack',
      project: 'webpack',
      path: '',
      url: 'https://github.com/webpack/webpack.git',
    });

    expect(getRepositoryInfo(gitlabRepo)).toEqual({
      host: 'gitlab.com',
      user: 'hyper-expanse',
      project: 'semantic-release-gitlab',
      path: '',
      url: 'git+https://gitlab.com/hyper-expanse/semantic-release-gitlab.git',
    });

    expect(getRepositoryInfo(bitbucketRepo)).toEqual({
      host: 'bitbucket.org',
      user: '2klicdev',
      project: '2klic-sdk',
      path: '',
      url: 'git+https://bitbucket.org/2klicdev/2klic-sdk.git',
    });

    expect(getRepositoryInfo(githubRepoWithDirectory)).toEqual({
      host: 'github.com',
      user: 'facebook',
      project: 'react',
      path: 'packages/react-dom',
      url: 'https://github.com/facebook/react.git',
    });

    expect(getRepositoryInfo(githubRepoWithPathUrlAndDirectory)).toEqual({
      host: 'github.com',
      user: 'facebook',
      project: 'react',
      path: 'packages/react-dom',
      url: 'https://github.com/facebook/react/tree/master/packages/wrong',
    });
  });

  it('should return null if it cannot get information', () => {
    expect(getRepositoryInfo('')).toBe(null);
    expect(getRepositoryInfo(undefined)).toBe(null);
    expect(getRepositoryInfo(null)).toBe(null);
    expect(getRepositoryInfo('aaaaaaaa')).toBe(null);
  });
});

describe('alternative names', () => {
  test('name not yet ending in .js', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'places',
    };
    expect(formatPkg(pkg)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
      Array [
        "places",
        "places.js",
        "placesjs",
      ]
    `);
  });

  test('name ending in .js', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'places.js',
    };
    expect(formatPkg(pkg)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
            Array [
              "placesjs",
              "places js",
              "places",
              "places.js",
            ]
        `);
  });

  test('name ending in js', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'prismjs',
    };
    expect(formatPkg(pkg)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
      Array [
        "prismjs",
        "prism",
      ]
    `);
  });

  test('scoped package', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: '@algolia/places.js',
    };
    expect(formatPkg(pkg)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
            Array [
              "algoliaplacesjs",
              " algolia places js",
              "@algolia/places",
              "@algolia/places.js",
            ]
        `);
  });

  test('name with - and _', () => {
    const pkg: GetPackage = {
      ...BASE,
      name: 'this-is_a-dumb-name',
    };
    expect(formatPkg(pkg)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
      Array [
        "thisisadumbname",
        "this is a dumb name",
        "this-is_a-dumb-name.js",
        "this-is_a-dumb-namejs",
        "this-is_a-dumb-name",
      ]
    `);
  });
});

describe('moduleTypes', () => {
  test('type=module', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
        type: 'module',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('type=commonjs', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
        type: 'commonjs',
      }).moduleTypes
    ).toEqual(['cjs']);
  });

  test('module=xxx.js', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
        module: 'index.js',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('main: index.mjs', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
        main: 'index.mjs',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('main: index.cjs', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
        main: 'index.cjs',
      }).moduleTypes
    ).toEqual(['cjs']);
  });

  test('unknown', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'irrelevant',
      }).moduleTypes
    ).toEqual(['unknown']);
  });

  test('preact (esm & umd)', () => {
    expect(formatPkg(preact).moduleTypes).toEqual(['esm']);
  });

  test('silly broken package', () => {
    expect(
      formatPkg({
        ...BASE,
        name: 'whoever',
        // @ts-expect-error
        main: [{ personalMain: 'index.mjs' }],
      }).moduleTypes
    ).toEqual(['unknown']);
  });
});

describe('getMains', () => {
  test('main === string', () => {
    expect(getMains({ main: 'index.js' })).toEqual(['index.js']);
  });

  test('first if array', () => {
    expect(getMains({ main: ['index.js', 'ondex.jsx'] })).toEqual([
      'index.js',
      'ondex.jsx',
    ]);
  });

  test('index.js if undefined', () => {
    expect(getMains({ main: undefined })).toEqual(['index.js']);
  });

  test('nothing if object', () => {
    // @ts-expect-error
    expect(getMains({ main: { something: 'cool.js' } })).toEqual([]);
  });
});

describe('getExportKeys', () => {
  test('exports is missing', () => {
    expect(getExportKeys(undefined)).toEqual([]);
  });

  test('exports is one level', () => {
    expect(getExportKeys({ import: './lol.js', require: './cjs.js' })).toEqual([
      'import',
      'require',
    ]);
  });

  test('exports is two levels', () => {
    expect(
      getExportKeys({ '.': { import: './lol.js', require: './cjs.js' } })
    ).toEqual(['.', 'import', 'require']);
  });

  test('exports is repeated', () => {
    expect(
      getExportKeys({
        something: { import: './lol.js', require: './cjs.js' },
        bazoo: { import: './bazoo.js', require: './cjs.js' },
      })
    ).toEqual(['something', 'bazoo', 'import', 'require', 'import', 'require']);
  });

  test('exports is many levels', () => {
    expect(
      getExportKeys({
        something: { import: './lol.js', require: './cjs.js' },
        bazoo: {
          lol: { import: './bazoo.js', require: './cjs.js' },
          kol: 'test.js',
          mol: {
            bol: {
              condition: 'test.js',
            },
          },
        },
      })
    ).toEqual([
      'something',
      'bazoo',
      'import',
      'require',
      'lol',
      'kol',
      'mol',
      'import',
      'require',
      'bol',
      'condition',
    ]);
  });
});

describe('getStyleTypes', () => {
  test('style=css', () => {
    expect(
      formatPkg({
        ...BASE,
        style: '/style.min.css',
      }).styleTypes
    ).toEqual(['css']);
  });

  test('style=woff', () => {
    expect(
      formatPkg({
        ...BASE,
        style: '/font.woff',
      }).styleTypes
    ).toEqual(['woff']);
  });

  test('style=uppercase', () => {
    expect(
      formatPkg({
        ...BASE,
        style: '/STYLE.SCSS',
      }).styleTypes
    ).toEqual(['scss']);
  });

  test('style=empty', () => {
    expect(
      formatPkg({
        ...BASE,
        style: '',
      }).styleTypes
    ).toEqual([]);
  });

  test('style=undefined', () => {
    expect(
      formatPkg({
        ...BASE,
      }).styleTypes
    ).toEqual([]);
  });
});

describe('getVersions', () => {
  test("renames 'time' to versions", () => {
    expect(
      getVersions(
        {
          other: {
            'dist-tags': {},
            _rev: '',
            time: {
              created: 'a',
              modified: 'b',
              '1.2.3': '2020-04-04T01:04:57.069Z',
            },
          },
        },
        {
          versions: {
            '1.2.3': {
              ...BASE_VERSION,
            },
          },
        }
      )
    ).toEqual({
      '1.2.3': '2020-04-04T01:04:57.069Z',
    });
  });

  test("removes the 'created' and 'modified' keys", () => {
    expect(
      getVersions(
        {
          other: {
            'dist-tags': {},
            _rev: '',
            time: {
              created: '2020-04-04T01:04:57.069Z',
              modified: '2030-04-04T01:04:57.069Z',
              '1.2.3': '2020-04-04T01:04:57.069Z',
            },
          },
        },
        {
          versions: {
            '1.2.3': { ...BASE_VERSION },
          },
        }
      )
    ).toEqual({
      '1.2.3': '2020-04-04T01:04:57.069Z',
    });
  });

  test("removes versions which don't exist in 'versions'", () => {
    expect(
      getVersions(
        {
          other: {
            'dist-tags': {},
            _rev: '',
            time: {
              created: '2020-04-04T01:04:57.069Z',
              modified: '2030-04-04T01:04:57.069Z',
              '9000.10000.5': '3020-04-04T01:04:57.069Z',
              '1.2.3': '2020-04-04T01:04:57.069Z',
              '2.3.4': '2020-04-04T01:04:57.069Z',
            },
          },
        },
        {
          versions: {
            '1.2.3': { ...BASE_VERSION },
            '2.3.4': { ...BASE_VERSION },
          },
        }
      )
    ).toEqual({
      '1.2.3': '2020-04-04T01:04:57.069Z',
      '2.3.4': '2020-04-04T01:04:57.069Z',
    });
  });
});

describe('deprecated', () => {
  it('log deprecated reason and flag', () => {
    const pkg: GetPackage = {
      ...BASE,
      'dist-tags': {
        latest: '1.2.3',
      },
      versions: {
        '1.2.3': {
          ...BASE_VERSION,
          deprecated: 'Yes this is deprecated',
        },
      },
    };
    const formatted = formatPkg(pkg);

    expect(formatted).toMatchSnapshot({
      lastCrawl: expect.any(String),
      deprecated: 'Yes this is deprecated',
      isDeprecated: true,
      deprecatedReason: 'Yes this is deprecated',
      _searchInternal: {
        expiresAt: expect.any(Number),
      },
    });
  });
});

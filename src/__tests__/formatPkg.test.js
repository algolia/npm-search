import formatPkg, {
  getRepositoryInfo,
  getMains,
  getVersions,
} from '../formatPkg.js';
import rawPackages from './rawPackages.json';
import preact from './preact-simplified.json';
import isISO8601 from 'validator/lib/isISO8601.js';

it('transforms correctly', () => {
  rawPackages
    .map(formatPkg)
    .map(element => {
      expect(isISO8601(element.lastCrawl)).toBe(true);
      return element;
    })
    .map(formattedPackage =>
      expect(formattedPackage).toMatchSnapshot(
        {
          lastCrawl: expect.any(String),
        },
        formattedPackage.objectID
      )
    );
});

it('keeps .bin intact', () => {
  const createInstantSearchApp = rawPackages.find(
    pkg => pkg.name === 'create-instantsearch-app'
  );
  const formatted = formatPkg(createInstantSearchApp);
  expect(formatted.bin).toMatchInlineSnapshot(`
  Object {
    "create-instantsearch-app": "src/cli/index.js",
  }
  `);
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

  const readmeLength = formatted.readme.length;

  expect(readmeLength).toBeLessThan(475000);
  expect(ending).toBe(truncatedEnding);

  expect(formatted).toMatchSnapshot({
    readme: expect.any(String),
    lastCrawl: expect.any(String),
  });
});

it('adds angular cli schematics', () => {
  const angularSchema = {
    name: 'angular-cli-schema-1',
    schematics: 'bli-blo',
    keywords: ['hi'],
    lastPublisher: { name: 'angular-god' },
  };

  const formatted = formatPkg(angularSchema);
  expect(formatted.keywords).toEqual(['hi']);
  expect(formatted.computedKeywords).toEqual(['angular-cli-schematic']);
  expect(formatted.computedMetadata).toEqual({
    schematics: 'bli-blo',
  });
});

it('adds babel plugins', () => {
  const dogs = {
    name: '@babel/plugin-dogs',
    keywords: 'babel',
    lastPublisher: { name: 'xtuc' },
  };
  const unofficialDogs = {
    name: 'babel-plugin-dogs',
    keywords: ['dogs'],
    lastPublisher: { name: 'unknown' },
  };

  const formattedDogs = formatPkg(dogs);
  const formattedUnofficialDogs = formatPkg(unofficialDogs);

  expect(formattedDogs.keywords).toEqual(['babel']);
  expect(formattedUnofficialDogs.keywords).toEqual(['dogs']);

  expect(formattedDogs.computedKeywords).toEqual(['babel-plugin']);
  expect(formattedUnofficialDogs.computedKeywords).toEqual(['babel-plugin']);
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

  expect(formattedDogs.keywords).toEqual([]);
  expect(formattedUnofficialDogs.keywords).toEqual([]);
  expect(formattedScopedDogs.keywords).toEqual([]);

  expect(formattedDogs.computedKeywords).toEqual(['vue-cli-plugin']);
  expect(formattedUnofficialDogs.computedKeywords).toEqual(['vue-cli-plugin']);
  expect(formattedScopedDogs.computedKeywords).toEqual(['vue-cli-plugin']);
});

describe('adds yeoman generators', () => {
  it('should add if matches the criterions', () => {
    const dogs = {
      name: 'generator-dogs',
      keywords: ['yeoman-generator'],
      lastPublisher: { name: 'unknown' },
    };
    const formattedDogs = formatPkg(dogs);
    expect(formattedDogs.computedKeywords).toEqual(['yeoman-generator']);
  });
  it('should not add if does not start with generator-', () => {
    const dogs = {
      name: 'foo-dogs',
      keywords: ['yeoman-generator'],
      lastPublisher: { name: 'unknown' },
    };
    const formattedDogs = formatPkg(dogs);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
  it('should not add if does not contain yeoman-generator as a keyword', () => {
    const dogs = {
      name: 'generator-dogs',
      keywords: ['foo'],
      lastPublisher: { name: 'unknown' },
    };
    const formattedDogs = formatPkg(dogs);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
});

describe('adds webpack scaffolds', () => {
  it('should add if matches the criterions', () => {
    const dogs = {
      name: 'webpack-scaffold-cats',
      lastPublisher: { name: 'unknown' },
    };
    const formattedDogs = formatPkg(dogs);
    expect(formattedDogs.computedKeywords).toEqual(['webpack-scaffold']);
  });
  it('should not add if does not start with generator-', () => {
    const dogs = {
      name: 'foo-dogs',
      lastPublisher: { name: 'unknown' },
    };
    const formattedDogs = formatPkg(dogs);
    expect(formattedDogs.computedKeywords).toEqual([]);
  });
});

describe('adds TypeScript information', () => {
  it('adds types if included in the package.json', () => {
    expect(
      formatPkg({
        name: 'xxx',
        lastPublisher: { name: 'unknown' },
        types: './test.dts',
      })
    ).toEqual(expect.objectContaining({ types: { ts: 'included' } }));

    expect(
      formatPkg({
        name: 'xxx',
        lastPublisher: { name: 'unknown' },
        typings: './test.dts',
      })
    ).toEqual(expect.objectContaining({ types: { ts: 'included' } }));
  });

  it('adds types possible if we can find a main file', () => {
    expect(
      formatPkg({
        name: 'xxx',
        lastPublisher: { name: 'unknown' },
        main: 'main.js',
      })
    ).toEqual(
      expect.objectContaining({
        types: { ts: { possible: true, dtsMain: 'main.d.ts' } },
      })
    );

    expect(
      formatPkg({
        name: 'xxx',
        lastPublisher: { name: 'unknown' },
      })
    ).toEqual(
      expect.objectContaining({
        types: { ts: { possible: true, dtsMain: 'index.d.ts' } },
      })
    );
  });

  it('gives up when no main is not js', () => {
    expect(
      formatPkg({
        name: 'xxx',
        main: 'shell-script.sh',
        lastPublisher: { name: 'unknown' },
      })
    ).toEqual(expect.objectContaining({ types: { ts: false } }));
  });
});

describe('getRepositoryInfo', () => {
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

    expect(getRepositoryInfo(githubRepoWithDirectory)).toEqual({
      host: 'github.com',
      user: 'facebook',
      project: 'react',
      path: 'packages/react-dom',
    });

    expect(getRepositoryInfo(githubRepoWithPathUrlAndDirectory)).toEqual({
      host: 'github.com',
      user: 'facebook',
      project: 'react',
      path: 'packages/react-dom',
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
    const original = {
      name: 'places',
      lastPublisher: { name: 'unknown' },
    };
    expect(formatPkg(original)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
      Array [
        "places",
        "places.js",
        "placesjs",
      ]
    `);
  });

  test('name ending in .js', () => {
    const original = {
      name: 'places.js',
      lastPublisher: { name: 'unknown' },
    };
    expect(formatPkg(original)._searchInternal.alternativeNames)
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
    const original = {
      name: 'prismjs',
      lastPublisher: { name: 'unknown' },
    };
    expect(formatPkg(original)._searchInternal.alternativeNames)
      .toMatchInlineSnapshot(`
      Array [
        "prismjs",
        "prism",
      ]
    `);
  });

  test('scoped package', () => {
    const original = {
      name: '@algolia/places.js',
      lastPublisher: { name: 'unknown' },
    };
    expect(formatPkg(original)._searchInternal.alternativeNames)
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
    const original = {
      name: 'this-is_a-dumb-name',
      lastPublisher: { name: 'unknown' },
    };
    expect(formatPkg(original)._searchInternal.alternativeNames)
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
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
        type: 'module',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('type=commonjs', () => {
    expect(
      formatPkg({
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
        type: 'commonjs',
      }).moduleTypes
    ).toEqual(['cjs']);
  });

  test('module=xxx.js', () => {
    expect(
      formatPkg({
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
        module: 'index.js',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('main: index.mjs', () => {
    expect(
      formatPkg({
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
        main: 'index.mjs',
      }).moduleTypes
    ).toEqual(['esm']);
  });

  test('main: index.cjs', () => {
    expect(
      formatPkg({
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
        main: 'index.cjs',
      }).moduleTypes
    ).toEqual(['cjs']);
  });

  test('unknown', () => {
    expect(
      formatPkg({
        name: 'irrelevant',
        lastPublisher: { name: 'unknown' },
      }).moduleTypes
    ).toEqual(['unknown']);
  });

  test('preact (esm & umd)', () => {
    expect(formatPkg(preact).moduleTypes).toEqual(['esm']);
  });

  test('silly broken package', () => {
    expect(
      formatPkg({
        name: 'whoever',
        lastPublisher: { name: 'unknown' },
        main: [{ personalMain: 'index.mjs' }],
      }).moduleTypes
    ).toEqual(['unknown']);
  });
});

describe('getMain', () => {
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
    expect(getMains({ main: { something: 'cool.js' } })).toEqual([]);
  });
});

describe('getVersions', () => {
  test("renames 'time' to versions", () => {
    expect(
      getVersions(
        {
          other: {
            time: {
              '1.2.3': '2020-04-04T01:04:57.069Z',
            },
          },
        },
        {
          versions: {
            '1.2.3': {},
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
            time: {
              created: '2020-04-04T01:04:57.069Z',
              modified: '2030-04-04T01:04:57.069Z',
              '1.2.3': '2020-04-04T01:04:57.069Z',
            },
          },
        },
        {
          versions: {
            '1.2.3': {},
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
            '1.2.3': {},
            '2.3.4': {},
          },
        }
      )
    ).toEqual({
      '1.2.3': '2020-04-04T01:04:57.069Z',
      '2.3.4': '2020-04-04T01:04:57.069Z',
    });
  });
});

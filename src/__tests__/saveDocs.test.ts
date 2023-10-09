import algoliasearch from 'algoliasearch';

import { formatPkg } from '../formatPkg';
import { hits } from '../jsDelivr';
import { cacheTotalDownloads } from '../npm';
import { saveDoc } from '../saveDocs';

import preact from './preact-simplified.json';

jest.setTimeout(15000);

const FINAL_BASE = {
  _revision: expect.any(Number),
  // _downloadsMagnitude: 7,
  // _jsDelivrPopularity: 0,
  _searchInternal: {
    alternativeNames: ['preact', 'preact.js', 'preactjs'],
    // popularAlternativeNames: ['preact', 'preact.js', 'preactjs'],
  },
  bin: {},
  changelogFilename: null,
  computedKeywords: [],
  computedMetadata: {},
  created: 1441939293521,
  dependencies: {},
  dependents: 0,
  deprecated: false,
  deprecatedReason: null,
  description:
    'Fast 3kb React alternative with the same modern API. Components &amp; Virtual DOM.',
  devDependencies: {
    '@types/chai': '^4.1.7',
    '@types/mocha': '^5.2.5',
    '@types/node': '^9.6.40',
    'babel-cli': '^6.24.1',
    'babel-core': '^6.24.1',
    'babel-eslint': '^8.2.6',
    'babel-loader': '^7.0.0',
    'babel-plugin-transform-object-rest-spread': '^6.23.0',
    'babel-plugin-transform-react-jsx': '^6.24.1',
    'babel-preset-env': '^1.6.1',
    bundlesize: '^0.17.0',
    chai: '^4.2.0',
    copyfiles: '^2.1.0',
    'core-js': '^2.6.0',
    coveralls: '^3.0.0',
    'cross-env': '^5.1.4',
    diff: '^3.0.0',
    eslint: '^4.18.2',
    'eslint-plugin-react': '^7.11.1',
    'flow-bin': '^0.89.0',
    'gzip-size-cli': '^2.0.0',
    'istanbul-instrumenter-loader': '^3.0.0',
    jscodeshift: '^0.5.0',
    karma: '^3.1.3',
    'karma-babel-preprocessor': '^7.0.0',
    'karma-chai-sinon': '^0.1.5',
    'karma-chrome-launcher': '^2.2.0',
    'karma-coverage': '^1.1.2',
    'karma-mocha': '^1.3.0',
    'karma-mocha-reporter': '^2.2.5',
    'karma-sauce-launcher': '^1.2.0',
    'karma-sinon': '^1.0.5',
    'karma-source-map-support': '^1.3.0',
    'karma-sourcemap-loader': '^0.3.6',
    'karma-webpack': '^3.0.5',
    mocha: '^5.0.4',
    'npm-run-all': '^4.1.5',
    puppeteer: '^1.11.0',
    rimraf: '^2.5.3',
    rollup: '^0.57.1',
    'rollup-plugin-babel': '^3.0.2',
    'rollup-plugin-memory': '^3.0.0',
    'rollup-plugin-node-resolve': '^3.4.0',
    sinon: '^4.4.2',
    'sinon-chai': '^3.3.0',
    typescript: '^3.0.1',
    'uglify-js': '^2.7.5',
    webpack: '^4.27.1',
  },
  downloadsLast30Days: 2874638,
  downloadsRatio: 0.0023,
  gitHead: 'master',
  githubRepo: {
    head: 'master',
    path: '',
    project: 'preact',
    user: 'developit',
  },
  homepage: null,
  humanDependents: '0',
  humanDownloadsLast30Days: '2.9m',
  isDeprecated: false,
  jsDelivrHits: 0,
  keywords: [
    'preact',
    'react',
    'virtual dom',
    'vdom',
    'components',
    'virtual',
    'dom',
  ],
  lastCrawl: '2021-07-11T12:31:18.112Z',
  lastPublisher: {
    avatar: 'https://gravatar.com/avatar/ad82ff1463f3e3b7b4a44c5f499912ae',
    email: 'npm.leah@hrmny.sh',
    link: 'https://www.npmjs.com/~harmony',
    name: 'harmony',
  },
  license: 'MIT',
  modified: 1564778088321,
  moduleTypes: ['esm'],
  name: 'preact',
  objectID: 'preact',
  originalAuthor: {
    email: 'jason@developit.ca',
    name: 'Jason Miller',
  },
  owner: {
    avatar: 'https://github.com/developit.png',
    link: 'https://github.com/developit',
    name: 'developit',
  },
  owners: [
    {
      avatar: 'https://gravatar.com/avatar/85ed8e6da2fbf39abeb4995189be324c',
      email: 'jason@developit.ca',
      link: 'https://www.npmjs.com/~developit',
      name: 'developit',
    },
    {
      avatar: 'https://gravatar.com/avatar/52401c37bc5c4d54a051c619767fdbf8',
      email: 'ulliftw@gmail.com',
      link: 'https://www.npmjs.com/~harmony',
      name: 'harmony',
    },
    {
      avatar: 'https://gravatar.com/avatar/308439e12701ef85245dc0632dd07c2a',
      email: 'luke@lukeed.com',
      link: 'https://www.npmjs.com/~lukeed',
      name: 'lukeed',
    },
    {
      avatar: 'https://gravatar.com/avatar/4ed639a3ea6219b80b58e2e81ff9ba47',
      email: 'marvin@marvinhagemeister.de',
      link: 'https://www.npmjs.com/~marvinhagemeister',
      name: 'marvinhagemeister',
    },
    {
      avatar: 'https://gravatar.com/avatar/83589d88ac76ddc2853562f9a817fe27',
      email: 'prateek89born@gmail.com',
      link: 'https://www.npmjs.com/~prateekbh',
      name: 'prateekbh',
    },
    {
      avatar: 'https://gravatar.com/avatar/88747cce15801e9e96bcb76895fcd7f9',
      email: 'hello@preactjs.com',
      link: 'https://www.npmjs.com/~preactjs',
      name: 'preactjs',
    },
    {
      avatar: 'https://gravatar.com/avatar/d279821c96bb49eeaef68b5456f42074',
      email: 'allamsetty.anup@gmail.com',
      link: 'https://www.npmjs.com/~reznord',
      name: 'reznord',
    },
  ],
  popular: false,
  readme: '',
  repository: {
    branch: 'master',
    head: undefined,
    host: 'github.com',
    path: '',
    project: 'preact',
    type: 'git',
    url: 'https://github.com/developit/preact',
    user: 'developit',
  },
  tags: {
    latest: '8.5.0',
    next: '10.0.0-rc.1',
  },
  types: {
    ts: 'included',
  },
  version: '8.5.0',
  versions: {
    '10.0.0-rc.1': '2019-08-02T20:34:45.123Z',
    '8.5.0': '2019-08-02T18:34:23.572Z',
  },
};

describe('saveDoc', () => {
  beforeAll(async () => {
    cacheTotalDownloads.total = 1e15;
    hits.set('preact', { hits: 12345, popular: true });
    hits.set('reactjs', { hits: 1234, popular: false });
  });

  it('should always produce the same records', async () => {
    const client = algoliasearch('e', '');
    const index = client.initIndex('a');
    jest.spyOn(index, 'saveObject').mockImplementationOnce(() => {
      return true as any;
    });

    const final = {
      ...FINAL_BASE,
    };
    const clean = expect.objectContaining({
      ...final,
      jsDelivrHits: 12345,
      lastCrawl: expect.any(String),
      downloadsLast30Days: 0,
      downloadsRatio: 0,
      humanDownloadsLast30Days: '0',
      modified: expect.any(Number),
      _searchInternal: expect.objectContaining({
        ...final._searchInternal,
        popularAlternativeNames: ['preact', 'preact.js', 'preactjs'],
      }),
      _jsDelivrPopularity: 2,
      popular: true,
    });

    await saveDoc({ formatted: formatPkg(preact), index });

    expect(index.saveObject).toHaveBeenCalledWith(clean);
  });

  it('should reuse existing changelog and downloads data', async () => {
    const client = algoliasearch('e', '');
    const index = client.initIndex('a');
    jest.spyOn(index, 'saveObject').mockImplementationOnce(() => {
      return true as any;
    });

    const oneTimeDataIndex = client.initIndex('b');
    jest.spyOn(oneTimeDataIndex, 'getObject').mockImplementationOnce(() => {
      return { changelogFilename: '/resolved-from-index.md' } as any;
    });

    const periodicDataIndex = client.initIndex('c');
    jest.spyOn(periodicDataIndex, 'getObject').mockImplementationOnce(() => {
      return { packageNpmDownloads: 2233, totalNpmDownloads: 1e10 } as any;
    });

    const final = {
      ...FINAL_BASE,
    };
    const clean = expect.objectContaining({
      ...final,
      jsDelivrHits: 12345,
      changelogFilename: '/resolved-from-index.md',
      lastCrawl: expect.any(String),
      downloadsLast30Days: 2233,
      downloadsRatio: expect.any(Number),
      humanDownloadsLast30Days: '2.2k',
      modified: expect.any(Number),
      _searchInternal: expect.objectContaining({
        ...final._searchInternal,
        popularAlternativeNames: ['preact', 'preact.js', 'preactjs'],
      }),
      _jsDelivrPopularity: 2,
      popular: true,
    });

    await saveDoc({
      formatted: formatPkg(preact),
      index,
      oneTimeDataIndex,
      periodicDataIndex,
    });

    expect(index.saveObject).toHaveBeenCalledWith(clean);
  });

  it('should not add popular alternative names for non-popular packages', async () => {
    const client = algoliasearch('e', '');
    const index = client.initIndex('a');
    jest.spyOn(index, 'saveObject').mockImplementationOnce(() => {
      return true as any;
    });

    const final = {
      ...FINAL_BASE,
      name: 'reactjs',
      objectID: 'reactjs',
      tags: {
        latest: '1.0.0',
      },
      version: '1.0.0',
      versions: {
        '1.0.0': '2019-08-02T18:34:23.572Z',
      },
    };
    const clean = expect.objectContaining({
      ...final,
      jsDelivrHits: 1234,
      lastCrawl: expect.any(String),
      downloadsLast30Days: 0,
      downloadsRatio: 0,
      humanDownloadsLast30Days: '0',
      modified: expect.any(Number),
      _searchInternal: expect.objectContaining({
        popularAlternativeNames: [],
      }),
    });

    await saveDoc({
      formatted: formatPkg({
        ...preact,
        name: 'reactjs',
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            ...preact.versions['8.5.0'],
            name: 'reactjs',
            version: '1.0.0',
          },
        },
        time: {
          ...preact.time,
          '1.0.0': '2019-08-02T18:34:23.572Z',
        },
      }),
      index,
    });

    expect(index.saveObject).toHaveBeenCalledWith(clean);
  });

  it('should skip getting extra data for security held packages', async () => {
    const client = algoliasearch('e', '');
    const index = client.initIndex('a');
    jest.spyOn(index, 'saveObject').mockImplementationOnce(() => {
      return true as any;
    });

    const final = {
      ...FINAL_BASE,
      name: 'trello-enterprises',
      objectID: 'trello-enterprises',
      tags: {
        latest: '1000.1000.1000',
      },
      version: '1000.1000.1000',
      versions: {
        '1000.1000.1000': '2019-08-02T18:34:23.572Z',
      },
      repository: {
        branch: 'master',
        head: undefined,
        host: 'github.com',
        path: '',
        project: 'security-holder',
        type: 'git',
        url: 'https://github.com/npm/security-holder',
        user: 'npm',
      },
      githubRepo: {
        head: 'master',
        path: '',
        project: 'security-holder',
        user: 'npm',
      },
      downloadsLast30Days: 0,
      humanDownloadsLast30Days: '0',
      isSecurityHeld: true,
    };
    const clean = expect.objectContaining({
      ...final,
      owner: expect.any(Object),
      homepage: expect.any(String),
      lastCrawl: expect.any(String),
      downloadsRatio: expect.any(Number),
      modified: expect.any(Number),
      _searchInternal: expect.objectContaining({
        popularAlternativeNames: [],
      }),
    });

    await saveDoc({
      formatted: formatPkg({
        ...preact,
        name: 'trello-enterprises',
        'dist-tags': { latest: '1000.1000.1000' },
        versions: {
          '1000.1000.1000': {
            ...preact.versions['8.5.0'],
            name: 'trello-enterprises',
            version: '1000.1000.1000',
          },
        },
        time: {
          ...preact.time,
          '1000.1000.1000': '2019-08-02T18:34:23.572Z',
        },
        repository: {
          type: 'git',
          url: 'https://github.com/npm/security-holder',
        },
      }),
      index,
    });

    expect(index.saveObject).toHaveBeenCalledWith(clean);
  });
});

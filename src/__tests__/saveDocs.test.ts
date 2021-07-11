import algoliasearch from 'algoliasearch';

import { saveDocs, saveDoc } from '../saveDocs';

import preact from './preact-simplified.json';

it('should be similar batch vs one', async () => {
  const client = algoliasearch('e', '');
  const index = client.initIndex('a');
  let batch;
  let single;
  jest.spyOn(index, 'saveObjects').mockImplementationOnce((val) => {
    batch = val[0];
    return true as any;
  });
  jest.spyOn(index, 'saveObject').mockImplementationOnce((val) => {
    single = val;
    return true as any;
  });
  const final = {
    _searchInternal: {
      alternativeNames: ['preact', 'preact.js', 'preactjs'],
      downloadsMagnitude: 7,
      expiresAt: '2021-08-10',
      jsDelivrPopularity: 0,
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
  const clean = expect.objectContaining({
    ...final,
    lastCrawl: expect.any(String),
    downloadsLast30Days: expect.any(Number),
    downloadsRatio: expect.any(Number),
    humanDownloadsLast30Days: expect.any(String),
    modified: expect.any(Number),
    _searchInternal: expect.objectContaining({
      downloadsMagnitude: expect.any(Number),
      expiresAt: expect.any(String),
    }),
  });

  const row = { id: '', key: 'preact', value: { rev: 'a' }, doc: preact };
  await saveDocs({ docs: [row], index });
  await saveDoc({ row, index });

  expect(index.saveObjects).toHaveBeenCalledWith([clean]);
  expect(index.saveObject).toHaveBeenCalledWith(clean);
  expect(single).toMatchObject({
    ...batch,
    lastCrawl: expect.any(String),
  });
});

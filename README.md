# 🗿 npm-search ⛷ 🐌 🛰

[npm](https://www.npmjs.com/) ↔️ [Algolia](https://www.algolia.com/) replication tool.

---

This is a failure resilient npm registry to Algolia index replication process.
It will replicate all npm packages to an Algolia index and keep it up to date.

The state of the replication is saved in Algolia index settings.

The replication should always be running. **Only one instance per Algolia index must run at the same time**.
If the process fails, restart it and the replication process will continue at the last point it remembers.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Algolia Index](#algolia-index)
  - [Schema](#schema)
  - [Ranking](#ranking)
- [Usage](#usage)
  - [Production](#production)
  - [Restart](#restart)
  - [Development](#development)
- [Env variables](#env-variables)
- [How does it work?](#how-does-it-work)
- [Tests](#tests)
- [Deploying new version](#deploying-new-version)
- [Forcing a complete re-index](#forcing-a-complete-re-index)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Algolia Index

### Schema

For every single NPM package, we create a record in the Algolia index. The resulting records have the following schema:

```json5
{
  name: 'babel-core',
  concatenatedName: 'babelcore',
  downloadsLast30Days: 10978749,
  downloadsRatio: 0.08310651682685861,
  humanDownloadsLast30Days: '11m',
  jsDelivrHits: 11684192,
  popular: true,
  version: '6.26.0',
  versions: {
    // [...]
    '7.0.0-beta.3': '2017-10-15T13:12:35.166Z',
  },
  tags: {
    latest: '6.26.0',
    old: '5.8.38',
    next: '7.0.0-beta.3',
  },
  description: 'Babel compiler core.',
  dependencies: {
    'babel-code-frame': '^6.26.0',
    // [...]
  },
  devDependencies: {
    'babel-helper-fixtures': '^6.26.0',
    // [...]
  },
  repository: {
    url: 'https://github.com/babel/babel/tree/master/packages/babel-core',
    host: 'github.com',
    user: 'babel',
    project: 'babel',
    path: '/tree/master/packages/babel-core',
    branch: 'master',
  },
  readme: '# babel-core\n\n> Babel compiler core.\n\n\n [... truncated at 200kb]',
  owner: {
    // either GitHub owner or npm owner
    name: 'babel',
    avatar: 'https://github.com/babel.png',
    link: 'https://github.com/babel',
  },
  deprecated: false,
  badPackage: false,
  homepage: 'https://babeljs.io/',
  license: 'MIT',
  keywords: [
    '6to5',
    'babel',
    'classes',
    'const',
    'es6',
    'harmony',
    'let',
    'modules',
    'transpile',
    'transpiler',
    'var',
    'babel-core',
    'compiler',
  ],
  created: 1424009748555,
  modified: 1508833762239,
  lastPublisher: {
    name: 'hzoo',
    email: 'hi@henryzoo.com',
    avatar: 'https://gravatar.com/avatar/851fb4fa7ca479bce1ae0cdf80d6e042',
    link: 'https://www.npmjs.com/~hzoo',
  },
  owners: [
    {
      email: 'me@thejameskyle.com',
      name: 'thejameskyle',
      avatar: 'https://gravatar.com/avatar/8a00efb48d632ae449794c094f7d5c38',
      link: 'https://www.npmjs.com/~thejameskyle',
    },
    // [...]
  ],
  lastCrawl: '2017-10-24T08:29:24.672Z',
  dependents: 3321,
  ts: undefined,
  humanDependents: '3.3k',
  changelogFilename: null, // if babel-core had a changelog, it would be the raw GitHub url here
  objectID: 'babel-core',
  _searchInternal: {
    popularName: 'babel-core',
    downloadsMagnitude: 8,
    jsDelivrPopularity: 5,
  },
}
```

### Ranking

If you want to learn more about how Algolia's ranking algorithm is working, you can read [this blog post](https://blog.algolia.com/search-ranking-algorithm-unveiled/).

#### Textual relevance

##### Searchable Attributes

We're restricting the search to use a subset of the attributes only:

- `_searchInternal.popularName`
- `name`
- `description`
- `keywords`
- `owner.name`
- `owners.name`

##### Prefix Search

Algolia provides default prefix search capabilities (matching words with only the beginning). This is disabled for the `owner.name` and `owners.name` attributes.

##### Typo-tolerance

Algolia provides default typo-tolerance.

##### Exact Boosting

Using the `optionalFacetFilters` feature of Algolia, we're boosting exact matches on the name of a package to always be on top of the results.

#### Custom/Business relevance

##### Number of downloads

For each package, we use the number of downloads in the last 30 days as Algolia's `customRanking` setting. This will be used to sort the results having the same textual-relevance against each others.

For instance, search for `babel` with match both `babel-core` and `babel-messages`. From a textual-relevance point of view, those 2 packages are exactly matching in the same way. In such case, Algolia will rely on the `customRanking` setting and therefore put the package with the highest number of downloads in the past 30 days first.

##### Popular packages

Some packages will be considered as popular if they have been downloaded "more" than others. We currently consider the packages having more than `0.005%` of the total number of downloads on the whole registry as the popular packages. This `popular` flag is also used to boost some records over non-popular ones.

## Usage

### Production

```sh
yarn
apiKey=... yarn start
```

### Restart

To restart from a particular point (or from the beginning):

```sh
seq=0 apiKey=... yarn start
```

This is useful when you want to completely resync the npm registry because:

- you changed the way you format packages
- you added more metadata (like GitHub stars)
- you are in an unsure state and you just want to restart everything

`seq` represents a [change sequence](http://docs.couchdb.org/en/2.0.0/json-structure.html#changes-information-for-a-database)
in CouchDB lingo.

### Development

Since the code is in ES6 and node.js, we compile to ES5 at the `install` process. To avoid having to rebuild
while developing, use:

```sh
seq=0 apiKey=... yarn dev
```

Be careful to develop on a different index than the production one when necessary.

## Env variables

See [config.js](./config.js):

- `apiKey`: [Algolia](https://www.algolia.com/) apiKey - **required**
- `appId`: [Algolia](https://www.algolia.com/) appId - _default `OFCNCOG2CU`_
- `indexName`: [Algolia](https://www.algolia.com/) indexName - _default `npm-search`_
- `bootstrapConcurrency`: How many docs to grab from npm registry at once in the bootstrap phase - _default `100`_
- `replicateConcurrency`: How many changes to grab from npm registry at once in the replicate phase - _default `10`_
- `seq`: npm registry first [change sequence](http://docs.couchdb.org/en/2.0.0/json-structure.html#changes-information-for-a-database)
  to start replication. In normal operations you should never have to use this. - _default `0`_
- `npmRegistryEndpoint`: npm registry endpoint to replicate from - _default `https://replicate.npmjs.com/registry`_
  This should be the only valid endpoint to replicate (even if a bit slow), see [this comment](https://github.com/npm/registry/issues/44#issuecomment-267732513).
- `npmDownloadsEndpoint`: Where to look for the last 30 days download of packages - _default `https://api.npmjs.org/downloads`_
- `popularDownloadsRatio`: % of total npm downloads for a package to be considered as popular
  how much % of it is needed for a package to be popular - _default 0.2_ This is a bit lower than
  the jQuery download range.

## How does it work?

Our goal with this project is to:

- be able to quickly do a complete rebuild
- be resilient to failures
- clean the package data

When the process starts with `seq=0`:

- save the [current sequence](https://replicate.npmjs.com/) of the npm registry in the state (Algolia settings)
- bootstrap the initial index content by using [/\_all_docs](http://docs.couchdb.org/en/2.0.0/api/database/bulk-api.html)
- replicate registry changes since the current sequence
- watch for registry changes continuously and replicate them

Replicate and watch are separated because:

1.  In replicate we want to replicate a batch of documents in a fast way
2.  In watch we want new changes as fast as possible, one by one. If watch was
    asking for batches of 100, new packages would be added too late to the index

## Tests

```sh
yarn test
```

Only linting.

## Deploying new version

[Setup heroku](https://devcenter.heroku.com/articles/git), then:

```sh
git push heroku master
```

## Forcing a complete re-index

This will force a reindex, without removing any existing package

```sh
heroku config:add seq=0
# check logs to see if it re-started
heroku logs -t
heroku config:remove seq
# check logs to see if it re-started
heroku logs -t
```

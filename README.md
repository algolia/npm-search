# 🗿 npm-search ⛷ 🐌 🛰

[npm](https://www.npmjs.com/) ↔️ [Algolia](https://www.algolia.com/) replication tool.

* * *

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

```json
{
  "name": "babel-core",
  "concatenatedName": "babelcore",
  "downloadsLast30Days": 7729599,
  "downloadsRatio": 0.0877900252270115,
  "humanDownloadsLast30Days": "7.7m",
  "popular": true,
  "version": "6.24.0",
  "versions": {
    "4.0.1": "2015-02-15T14:15:48.555Z",
    "4.0.2": "2015-02-17T02:14:19.635Z",
    "4.1.1": "2015-02-17T13:05:27.250Z",
    "4.2.0": "2015-02-18T00:32:53.715Z",
    [...]
  },
  "tags": {"latest":"6.25.0","old":"5.8.38","next":"7.0.0-alpha.19"},
  "description": "Babel compiler core.",
  "dependencies": {
    "babel-code-frame": "^6.22.0",
    [...]
  },
  "devDependencies": {
    "babel-helper-fixtures": "^6.22.0",
    [...]
  },
  "githubRepo": {
    "user": "babel",
    "project": "babel",
    "path": "/tree/master/packages/babel-core"
  },
  "readme": "# babel-core\n> Babel compiler core.\n```javascript\nvar babel = require(\"babel-core\");\nimport { transform } from 'babel-core';\nimport * as babel from 'babel-core';\n```\nAll transformations will use your local configuration files (.babelrc or in package.json). See [options](#options) to disable it.\n## babel.transform(code: string, [options?](#options): Object)\nTransforms the passed in `code`. Returning an object with the generated code,\nsource map, and AST.\n```js\nbabel.transform(code, options)", //truncated at 200kb with **TRUNCATED**
  "owner": {
    "name": "babel",
    "avatar": "https://github.com/babel.png",
    "link": "https://github.com/babel"
  },
  "deprecated": false,
  "homepage": "https://babeljs.io/",
  "license": "MIT",
  "keywords": ["6to5", "babel", "classes", "const", "es6", "harmony", "let", "modules", "transpile", "transpiler", "var"],
  "created": 1424009748555,
  "modified": 1490641779463,
  "lastPublisher": {
    "name": "hzoo",
    "email": "hi@henryzoo.com",
    "avatar": "https://gravatar.com/avatar/851fb4fa7ca479bce1ae0cdf80d6e042",
    "link": "https://www.npmjs.com/~hzoo"
  },
  "owners": [
    {
      "name": "amasad",
      "email": "amjad.masad@gmail.com",
      "avatar": "https://gravatar.com/avatar/03637ef1a5121222c8db0ed48c34e124",
      "link": "https://www.npmjs.com/~amasad"
    },
    [...]
  ],
  "lastCrawl": "2017-04-01T13:41:14.220Z",
  "popularName": "babel-core",
  "dependents": 3321,
  "humanDependents": "3.3k",
  "changelogFilename": null,
  "objectID": "babel-core"
}
```

### Ranking

If you want to learn more about how Algolia's ranking algorithm is working, you can read [this blog post](https://blog.algolia.com/search-ranking-algorithm-unveiled/).

#### Textual relevance

##### Searchable Attributes

We're restricting the search to use a subset of the attributes only:

 - `popularName`
 - `name`
 - `description`
 - `keywords`
 - `owner.name`
 - `owners.name`

##### Prefix Search

Algolia provides default prefix search capabilities (matching words with only the beginning). This is disabled for the `keywords`, `owner.name` and `owners.name` attributes.

##### Typo-tolerance

Algolia provides default typo-tolerance. Typo-tolerance is disabled for the `keywords` attribute.

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

To restart from a particular point (or from the begining):

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
- `appId`: [Algolia](https://www.algolia.com/) appId - *default `OFCNCOG2CU`*
- `indexName`: [Algolia](https://www.algolia.com/) indexName - *default `npm-search`*
- `bootstrapConcurrency`: How many docs to grab from npm registry at once in the bootstrap phase - *default `100`*
- `replicateConcurrency`: How many changes to grab from npm registry at once in the replicate phase - *default `10`*
- `seq`: npm registry first [change sequence](http://docs.couchdb.org/en/2.0.0/json-structure.html#changes-information-for-a-database)
  to start replication. In normal operations you should never have to use this. - *default `0`*
- `npmRegistryEndpoint`: npm registry endpoint to replicate from - *default `https://replicate.npmjs.com/registry`*
  This should be the only valid endpoint to replicate (even if a bit slow), see [this comment](https://github.com/npm/registry/issues/44#issuecomment-267732513).
- `npmDownloadsEndpoint`: Where to look for the last 30 days download of packages - *default `https://api.npmjs.org/downloads`*
- `popularDownloadsRatio`: % of total npm downloads for a package to be considered as popular
  how much % of it is needed for a package to be popular - *default 0.2* This is a bit lower than
  the jQuery download range.

## How does it work?

Our goal with this project is to:
- be able to quickly do a complete rebuild
- be resilient to failures
- clean the package data

When the process starts with `seq=0`:
- save the [current sequence](https://replicate.npmjs.com/) of the npm registry in the state (Algolia settings)
- bootstrap the initial index content by using [/_all_docs](http://docs.couchdb.org/en/2.0.0/api/database/bulk-api.html)
- replicate registry changes since the current sequence
- watch for registry changes continuously and replicate them

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

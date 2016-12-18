# 🗿 npm-search 🛰

[npm](https://www.npmjs.com/) ↔️ [Algolia](https://www.algolia.com/) replication tool.

* * *

This is a failure resilient npm registry to Algolia index replication process.
It will replicate all npm packages to an Algolia index and keep it up to date.

The state of the replication is saved in Algolia index settings.

The replication should always be running. **Only one instance per Algolia index must run at the same time**.
If the process fails, restart it and the replication process will continue at the last point it remembers.

## 📖 Usage

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

### Development

Since the code is in ES6 and node.js, we compile to ES5 at the `install` process. To avoid having to rebuild
while developing, use:

```sh
seq=0 apiKey=... yarn dev
```

Be careful to develop on a different index than the production one when necessary.

## ⚙ Env variables

See [config.js](./config.js):
- `apiKey`: [Algolia](https://www.algolia.com/) apiKey - **required**
- `appId`: [Algolia](https://www.algolia.com/) appId - *default `OFCNCOG2CU`*
- `indexName`: [Algolia](https://www.algolia.com/) indexName - *default `npm-search`*
- `concurrency`: How many changes to grab for npm registry at once - *default 200*
- `seq`: npm registry first [change sequence](http://docs.couchdb.org/en/2.0.0/json-structure.html#changes-information-for-a-database)
  to start replication. In normal operations you should never have to use this. - *default 0*
- `npmRegistryEndpoint`: default `https://replicate.npmjs.com/registry` - This should be the only valid
  endpoint, see [this comment](https://github.com/npm/registry/issues/44#issuecomment-267732513).
- `npmDownloadsEndpoint`: Where to look for the last 30 days download of packages
- `popularDownloadRange`: % of total npm downloads for a package to be considered as popular
  how much % of it is needed for a package to be popular

## Test

```sh
yarn test
```

Only linting.

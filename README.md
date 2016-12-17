# npm-search

🗿 NPM => Algolia replication.

## Usage

```sh
yarn
apiKey=... yarn start
```

Available env variables (see [config.js](./config.js)):
- appId
- apiKey
- indexName
- maximumConcurrency: How many packages to save at the same time to Algolia
- registryEndpoint: NPM registry endpoint, not sure today which one to use
- reset: force replication to start over, useful in dev

## Flow and status

The goal being: provide an always up to date search in term of data.

1. If there's an initial replication, throw, ask to run via reset (we cannot ensure any process failed)
2. If the initial replication is done, go to 6.
3. Save the current seq of the npm registry inside Algolia settings user data
4. Start initial replication
5. When initial replication is done, save that state in Algolia settings user data
6. Start watching the repository at the last seq.
7. Everytime there's a change, replicate it to Algolia and save new seq

Done: 1, 2, 3, 4, 5.

I am not yet sure which registry endpoint to use as for replication and watching.
I asked different people and will get answers soon. I have the tooling, but not the right data today.

Pointers for watch
https://github.com/npm/registry/issues/44
https://github.com/npm/registry-follower-tutorial
https://github.com/npm/concurrent-couch-follower
https://github.com/npm/normalize-registry-metadata

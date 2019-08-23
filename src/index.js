import createStateManager from './createStateManager.js';
import config from './config.js';
import * as algolia from './algolia/index.js';
import log from './log.js';
import datadog from './datadog.js';
import * as jsDelivr from './jsDelivr/index.js';
import * as typescript from './typescript/index.js';
import * as sentry from './utils/sentry.js';
// import PackagesFetcher from './npm/packagesFetcher.js';

import * as bootstrap from './bootstrap.js';
import * as watch from './watch.js';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

// const packagesFetcher = new PackagesFetcher(
//   {
//     limit: config.bootstrapConcurrency,
//     max: config.packagesPrefetchMax,
//     concurrency: 2,
//   },
//   stateManager
// );

/**
 * Main process
 *   - Bootstrap: will index the whole list of packages (if needed)
 *   - Watch    : will process update in real time
 */
async function main() {
  const start = Date.now();
  // first we make sure the bootstrap index has the correct settings
  log.info('💪  Setting up Algolia');
  const {
    client: algoliaClient,
    mainIndex,
    bootstrapIndex,
  } = await algolia.prepare(config);
  datadog.timing('main.init_algolia', Date.now() - start);

  // Create State Manager that holds progression of indexing
  const stateManager = createStateManager(mainIndex);

  // Preload some useful data
  await jsDelivr.loadHits();
  await typescript.loadTypesIndex();

  // then we run the bootstrap
  // after a bootstrap is done, it's moved to main (with settings)
  // if it was already finished, we will set the settings on the main index
  await bootstrap.run(stateManager, algoliaClient, mainIndex, bootstrapIndex);

  // then we figure out which updates we missed since
  // the last time main index was updated

  log.info('🚀  Launching Watch');
  await watch.run(stateManager, mainIndex);
}

main().catch(async err => {
  sentry.report(err);
  await sentry.drain();
  process.exit(1); // eslint-disable-line no-process-exit
});

//   start = Date.now();
//   log.info('🚀  Launching Replicate');
//   await replicate(await stateManager.get(), mainIndex);
//   datadog.timing('main.replicate', Date.now() - start);

//   // then we watch 👀 for all changes happening in the ecosystem
//   log.info('👀  Watching...');
//   return watch(await stateManager.get(), mainIndex);
// }

// async function bootstrap(state, algoliaClient, bootstrapIndex) {
//   await stateManager.save({
//     stage: 'bootstrap',
//   });

//   if (state.seq > 0 && state.bootstrapDone === true) {
//     log.info('⛷   Bootstrap: done');
//     return state;
//   }

//   await loadHits();

//   const { seq } = await npm.getInfo();
//   if (!state.bootstrapLastId) {
//     // Start from 0
//     // first time this launches, we need to remember the last seq our bootstrap can trust
//     await stateManager.save({ seq });
//   } else {
//     packagesFetcher.nextKey = state.bootstrapLastId;
//   }

//   Promise.all([
//     await packagesFetcher.syncTotalWithNPM(),
//     await packagesFetcher.syncOffset(),
//   ]);

//   log.info('-----');
//   log.info(`Total packages    ${packagesFetcher.total}`);
//   log.info(`Starting offset   ${packagesFetcher.nextOffset}`);
//   log.info(
//     '⛷   Bootstrap: starting at doc %s',
//     packagesFetcher.nextKey || '"first doc"'
//   );
//   log.info('-----');

//   await packagesFetcher.launch({ fullPreftech: true });

//   let lastProcessedId = state.bootstrapLastId;
//   while (lastProcessedId !== null) {
//     lastProcessedId = await bootstrapLoop(lastProcessedId, bootstrapIndex);
//   }

//   log.info('-----');
//   log.info('⛷   Bootstrap: done');
//   await stateManager.save({
//     bootstrapDone: true,
//     bootstrapLastDone: Date.now(),
//   });

//   return await moveToProduction(algoliaClient);
// }

// /**
//  * Execute one loop for bootstrap,
//  *   Fetch N packages from `lastProcessedId`, process and save them to Algolia
//  * @param {string} lastProcessedId
//  */
// async function bootstrapLoop(lastId, bootstrapIndex) {
//   const start = Date.now();
//   log.info('loop()');

//   const packages = packagesFetcher.get();
//   packagesFetcher.prefetch();

//   if (packages.length <= 0) {
//     if (packagesFetcher.isFinished) {
//       // Nothing left to process
//       // We return null to stop the bootstraping
//       log.info('loop done');
//       return null;
//     } else {
//       log.warn('🥴  We process packages faster than we prefetch them');
//       await wait(3000);
//       return lastProcessedId;
//     }
//   }

//   const newLastId = packages[packages.length - 1].id;
//   log.info('::', newLastId);

//   datadog.increment('packages', packages.length);
//   log.info('  - fetched', packages.length, 'packages');

//   const saved = await saveDocs({ docs: packages, index: bootstrapIndex });
//   await stateManager.save({
//     bootstrapLastId: newLastId,
//   });
//   log.info(`  - saved ${saved} packages`);

//   logBootstrapProgress(
//     packagesFetcher.actualOffset,
//     packages.length,
//     packagesFetcher.total
//   );

//   datadog.timing('loop', Date.now() - start);

//   // Be nice
//   await wait(1000);

//   return newLastId;
// }

import * as algolia from './algolia/index.js';
import config from './config.js';
import datadog from './datadog.js';
import log from './log.js';
import ms from 'ms';
import * as npm from './npm/index.js';
import PackagesFetcher from './npm/packagesFetcher.js';
import wait from './utils/wait.js';
import saveDocs from './saveDocs.js';

let loopStart;

/**
 * Bootstrap is the mode that goes from 0 to all the packages in NPM
 * In other word it is reindexing everything from scratch.
 *
 * It is useful if:
 *  - you are starting this project for the first time
 *  - you messed up with your Algolia index
 *  - you lagged too much behind
 *
 * Watch mode should/can be reliably left running for weeks/months as CouchDB is made for that.
 * BUT for the moment it's mandatory to relaunch it because it's the only way to update: typescript, downloads stats.
 */
async function run(stateManager, algoliaClient, mainIndex, bootstrapIndex) {
  const state = await stateManager.check();

  if (state.seq > 0 && state.bootstrapDone === true) {
    await algolia.putDefaultSettings(mainIndex, config);
    log.info('⛷   Bootstrap: done');
    return;
  }

  await stateManager.save({
    stage: 'bootstrap',
  });
  const packagesFetcher = new PackagesFetcher(
    {
      limit: config.bootstrapConcurrency,
      max: config.packagesPrefetchMax,
    },
    stateManager
  );

  const { seq } = await npm.getInfo();
  if (!state.bootstrapLastId) {
    // Start from 0
    // first time this launches, we need to remember the last seq our bootstrap can trust
    await stateManager.save({ seq });
    await algolia.putDefaultSettings(bootstrapIndex, config);
  } else {
    packagesFetcher.nextKey = state.bootstrapLastId;
  }

  // Firsy sync packagesFetcher
  Promise.all([
    await packagesFetcher.syncTotalWithNPM(),
    await packagesFetcher.syncOffset(),
  ]);

  log.info('-----');
  log.info(`Total packages   ${packagesFetcher.total}`);
  log.info(`Starting offset   ${packagesFetcher.nextOffset}`);
  log.info(
    '⛷   Bootstrap: starting at doc %s',
    packagesFetcher.nextKey || '"first doc"'
  );
  log.info('-----');

  // Prefetch max before starting to have a head start
  await packagesFetcher.launch({ fullPreftech: true });

  let lastProcessedId = state.bootstrapLastId;
  while (lastProcessedId !== null) {
    loopStart = Date.now();

    lastProcessedId = await loop(
      lastProcessedId,
      stateManager,
      bootstrapIndex,
      packagesFetcher
    );
  }

  log.info('-----');
  log.info('⛷   Bootstrap: done');
  await stateManager.save({
    bootstrapDone: true,
    bootstrapLastDone: Date.now(),
  });

  await moveToProduction(stateManager, algoliaClient);
}

/**
 * Execute one loop for bootstrap,
 *   Fetch N packages from `lastId`, process and save them to Algolia
 * @param {string} lastId
 */
async function loop(lastId, stateManager, bootstrapIndex, packagesFetcher) {
  const start = Date.now();
  log.info('loop()', '::', lastId);

  const packages = await packagesFetcher.get();
  if (!packages) {
    // Nothing left to process
    // We return null to stop the bootstraping
    log.info('loop done');
    return null;
  }

  packagesFetcher.prefetch();

  const newLastId = packages[packages.length - 1].id;
  log.info('::', newLastId);

  datadog.increment('packages', packages.length);
  log.info(
    '  - fetched',
    packages.length,
    'packages',
    `(${packagesFetcher.storage.length} in storage)`
  );

  const saved = await saveDocs({ docs: packages, index: bootstrapIndex });
  await stateManager.save({
    bootstrapLastId: newLastId,
  });
  log.info(`  - saved ${saved} packages`);

  await logProgress(
    packagesFetcher.actualOffset,
    packages.length,
    packagesFetcher.total
  );

  datadog.timing('loop', Date.now() - start);

  // Be nice
  await wait(1000);

  return newLastId;
}

async function moveToProduction(stateManager, algoliaClient) {
  log.info('🚚  starting move to production');

  const currentState = await stateManager.get();
  await algoliaClient.copyIndex(config.bootstrapIndexName, config.indexName);

  await stateManager.save(currentState);
}

const lastMinutes = [];
const maxMinutes = 10;
function logProgress(offset, nbDocs, totalDocs) {
  // ------- Current rate
  const ratePerSecond = nbDocs / ((Date.now() - loopStart) / 1000);

  log.info(
    `[progress] %d/%d docs (%d%), current rate: %d docs/s (%s remaining)`,
    offset + nbDocs,
    totalDocs,
    Math.floor((Math.max(offset + nbDocs, 1) / totalDocs) * 100),
    Math.round(ratePerSecond),
    ms(((totalDocs - offset - nbDocs) / ratePerSecond) * 1000)
  );

  // ------- Last minutes
  const thisMinute = new Date().getMinutes();
  if (lastMinutes.length > maxMinutes) {
    lastMinutes.shift();
  }

  const alreadyPushed = lastMinutes.findIndex(v => v[0] === thisMinute);
  if (alreadyPushed >= 0) {
    lastMinutes[alreadyPushed][1] += nbDocs;
  } else {
    lastMinutes.push([thisMinute, nbDocs]);
  }
  const totalLastMinutes = lastMinutes.reduce((p, v) => p + v[1], 0);
  const ratesLastMinutes = totalLastMinutes / (lastMinutes.length * 60);

  log.info(
    `[progress] last %d minutes (%d docs): %d docs/s (%s remaining)`,
    lastMinutes.length,
    totalLastMinutes,
    Math.round(ratesLastMinutes),
    ms(((totalDocs - offset - nbDocs) / ratesLastMinutes) * 1000)
  );
}

export { run };

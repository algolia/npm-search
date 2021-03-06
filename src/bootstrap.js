import * as algolia from './algolia/index.js';
import config from './config.js';
import datadog from './datadog.js';
import log from './log.js';
import ms from 'ms';
import * as npm from './npm/index.js';
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

  const { seq, nbDocs: totalDocs } = await npm.getInfo();
  if (!state.bootstrapLastId) {
    // Start from 0
    log.info('⛷   Bootstrap: starting from the first doc');
    // first time this launches, we need to remember the last seq our bootstrap can trust
    await stateManager.save({ seq });
    await algolia.putDefaultSettings(bootstrapIndex, config);
  } else {
    log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
  }

  log.info('-----');
  log.info(`Total packages   ${totalDocs}`);
  log.info('-----');

  let lastProcessedId = state.bootstrapLastId;
  while (lastProcessedId !== null) {
    loopStart = Date.now();

    lastProcessedId = await loop(lastProcessedId, stateManager, bootstrapIndex);
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
async function loop(lastId, stateManager, bootstrapIndex) {
  const start = Date.now();
  log.info('loop()', '::', lastId);

  const options = {
    limit: config.bootstrapConcurrency,
  };
  if (lastId) {
    options.startkey = lastId;
    options.skip = 1;
  }

  const res = await npm.findAll(options);

  if (res.rows.length <= 0) {
    // Nothing left to process
    // We return null to stop the bootstraping
    return null;
  }

  datadog.increment('packages', res.rows.length);
  log.info('  - fetched', res.rows.length, 'packages');

  const newLastId = res.rows[res.rows.length - 1].id;

  const saved = await saveDocs({ docs: res.rows, index: bootstrapIndex });
  await stateManager.save({
    bootstrapLastId: newLastId,
  });
  log.info(`  - saved ${saved} packages`);

  await logProgress(res.offset, res.rows.length);

  datadog.timing('loop', Date.now() - start);

  return newLastId;
}

async function moveToProduction(stateManager, algoliaClient) {
  log.info('🚚  starting move to production');

  const currentState = await stateManager.get();
  await algoliaClient.copyIndex(config.bootstrapIndexName, config.indexName);

  await stateManager.save(currentState);
}

async function logProgress(offset, nbDocs) {
  const { nbDocs: totalDocs } = await npm.getInfo();

  const ratePerSecond = nbDocs / ((Date.now() - loopStart) / 1000);
  log.info(
    `[progress] %d/%d docs (%d%), current rate: %d docs/s (%s remaining)`,
    offset + nbDocs,
    totalDocs,
    Math.floor((Math.max(offset + nbDocs, 1) / totalDocs) * 100),
    Math.round(ratePerSecond),
    ms(((totalDocs - offset - nbDocs) / ratePerSecond) * 1000)
  );
}

export { run };

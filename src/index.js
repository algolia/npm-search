import ms from 'ms';
import cargo from 'async/cargo.js';
import queue from 'async/queue.js';

import createStateManager from './createStateManager.js';
import saveDocs from './saveDocs.js';
import config from './config.js';
import * as algolia from './algolia/index.js';
import * as npm from './npm/index.js';
import log from './log.js';
import datadog from './datadog.js';
import * as jsDelivr from './jsDelivr/index.js';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

let loopStart = Date.now();

/**
 * Main process
 *   - Bootstrap: will index the whole list of packages (if needed)
 *   - Replicate: will process the delta of missing update we may of miss during bootstrap
 *   - Watch    : will process update in real time
 */
async function main() {
  let start = Date.now();
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

  // then we run the bootstrap
  // after a bootstrap is done, it's moved to main (with settings)
  // if it was already finished, we will set the settings on the main index
  start = Date.now();
  log.info('⛷   Bootstraping');
  await bootstrap(stateManager, algoliaClient, mainIndex, bootstrapIndex);
  datadog.timing('main.bootsrap', Date.now() - start);

  // then we figure out which updates we missed since
  // the last time main index was updated
  start = Date.now();
  log.info('🚀  Launching Replicate');
  await replicate(stateManager, mainIndex);
  datadog.timing('main.replicate', Date.now() - start);

  // then we watch 👀 for all changes happening in the ecosystem
  log.info('👀  Watching...');
  return watch(stateManager, mainIndex);
}

main().catch(error);

async function logUpdateProgress(seq, nbChanges, emoji) {
  const npmInfo = await npm.getInfo();
  const ratePerSecond = nbChanges / ((Date.now() - loopStart) / 1000);
  const remaining = ((npmInfo.seq - seq) / ratePerSecond) * 1000 || 0;
  log.info(
    `${emoji}   Synced %d/%d changes (%d%), current rate: %d changes/s (%s remaining)`,
    seq,
    npmInfo.seq,
    Math.floor((Math.max(seq, 1) / npmInfo.seq) * 100),
    Math.round(ratePerSecond),
    ms(remaining)
  );
  loopStart = Date.now();
}

async function logBootstrapProgress(offset, nbDocs) {
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
  loopStart = Date.now();
}

async function bootstrap(
  stateManager,
  algoliaClient,
  mainIndex,
  bootstrapIndex
) {
  const state = await stateManager.check();
  await stateManager.save({
    stage: 'bootstrap',
  });

  if (state.seq > 0 && state.bootstrapDone === true) {
    await algolia.putDefaultSettings(mainIndex);
    log.info('⛷   Bootstrap: done');
    return state;
  }

  const { seq, nbDocs: totalDocs } = await npm.getInfo();
  if (!state.bootstrapLastId) {
    // Start from 0
    log.info('⛷   Bootstrap: starting from the first doc');
    // first time this launches, we need to remember the last seq our bootstrap can trust
    await stateManager.save({ seq });
    await algolia.putDefaultSettings(bootstrapIndex);
  } else {
    log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
  }

  log.info('-----');
  log.info(`Total packages   ${totalDocs}`);
  log.info('-----');

  let lastProcessedId = state.bootstrapLastId;
  while (lastProcessedId !== null) {
    lastProcessedId = await bootstrapLoop(
      lastProcessedId,
      stateManager,
      bootstrapIndex
    );
  }

  log.info('-----');
  log.info('⛷   Bootstrap: done');
  await stateManager.save({
    bootstrapDone: true,
    bootstrapLastDone: Date.now(),
  });

  return await moveToProduction(stateManager, algoliaClient);
}

/**
 * Execute one loop for bootstrap,
 *   Fetch N packages from `lastId`, process and save them to Algolia
 * @param {string} lastId
 */
async function bootstrapLoop(lastId, stateManager, bootstrapIndex) {
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

  await logBootstrapProgress(res.offset, res.rows.length);

  datadog.timing('loop', Date.now() - start);

  return newLastId;
}

async function moveToProduction(stateManager, algoliaClient) {
  log.info('🚚  starting move to production');

  const currentState = await stateManager.get();
  await algoliaClient.copyIndex(config.bootstrapIndexName, config.indexName);

  await stateManager.save(currentState);
}

async function replicate(stateManager, mainIndex) {
  const { seq } = await stateManager.get();
  log.info(
    '🐌   Replicate: Asking for %d changes since sequence %d',
    config.replicateConcurrency,
    seq
  );

  await stateManager.save({
    stage: 'replicate',
  });

  const { seq: npmSeqToReach } = await npm.getInfo();
  let npmSeqReached = false;

  return new Promise((resolve, reject) => {
    const listener = npm.listenToChanges({
      since: seq,
      batch_size: config.replicateConcurrency, // eslint-disable-line camelcase
      live: true,
      return_docs: false, // eslint-disable-line camelcase
    });

    const changesConsumer = cargo(async docs => {
      datadog.increment('packages', docs.length);
      log.info(`🐌  Replicate received ${docs.length} packages`);

      try {
        await saveDocs({ docs, index: mainIndex });
        await logUpdateProgress(docs[docs.length - 1].seq, 1, '🐌');
        await stateManager.save({
          seq: docs[docs.length - 1].seq,
        });
        return true;
      } catch (e) {
        return e;
      }
    }, config.replicateConcurrency);

    listener.on('change', async change => {
      if (change.deleted === true) {
        await mainIndex.deleteObject(change.id);
        log.info(`🐌  Deleted ${change.id}`);
      }

      changesConsumer.push(change, err => {
        if (err) {
          reject(err);
        }
      });

      if (change.seq >= npmSeqToReach) {
        npmSeqReached = true;
        listener.cancel();
      }
    });
    listener.on('error', reject);

    changesConsumer.drain(() => {
      if (npmSeqReached) {
        log.info('🐌  We reached the npm current sequence');
        resolve();
      }
    });
  });
}

async function watch(stateManager, mainIndex) {
  const { seq } = await stateManager.get();
  log.info(
    `🛰   Watch: 👍 We are in sync (or almost). Will now be 🔭 watching for registry updates, since ${seq}`
  );

  await stateManager.save({
    stage: 'watch',
  });

  return new Promise((resolve, reject) => {
    const listener = npm.listenToChanges({
      since: seq,
      live: true,
      batch_size: 1, // eslint-disable-line camelcase
      return_docs: false, // eslint-disable-line camelcase
    });

    const changesConsumer = queue(async change => {
      datadog.increment('packages');
      log.info(`🛰  Watch received 1 packages`);

      try {
        await saveDocs({ docs: [change], index: mainIndex });
        await logUpdateProgress(change.seq, 1, '🛰');
        await stateManager.save({
          seq: change.seq,
        });
        const { bootstrapLastDone } = await stateManager.get();

        const now = Date.now();
        const lastBootstrapped = new Date(bootstrapLastDone);
        // when the process is running longer than a certain time
        // we want to start over and get all info again
        // we do this by exiting and letting Heroku start over
        if (now - lastBootstrapped > config.timeToRedoBootstrap) {
          await stateManager.set({
            seq: 0,
            bootstrapDone: false,
          });
          process.exit(0); // eslint-disable-line no-process-exit
        }

        return null;
      } catch (e) {
        return e;
      }
    }, 1);

    listener.on('change', async change => {
      if (change.deleted === true) {
        await mainIndex.deleteObject(change.id);
        log.info(`🛰 Deleted ${change.id}`);
      }
      changesConsumer.push(change, err => {
        if (err) {
          reject(err);
        }
      });
    });
    listener.on('error', reject);
  });
}

function error(err) {
  console.error(err); // eslint-disable-line no-console
  process.exit(1); // eslint-disable-line no-process-exit
}

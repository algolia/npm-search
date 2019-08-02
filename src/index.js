import PouchDB from 'pouchdb-http';
import ms from 'ms';
import cargo from 'async/cargo.js';
import queue from 'async/queue.js';
import createStateManager from './createStateManager.js';
import saveDocs from './saveDocs.js';
import createAlgoliaIndex from './createAlgoliaIndex.js';
import c from './config.js';
import * as npm from './npm.js';
import log from './log.js';
import datadog from './datadog.js';
import { loadHits } from './jsDelivr.js';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

const db = new PouchDB(c.npmRegistryEndpoint, {
  ajax: {
    timeout: ms('2.5m'), // default is 10s
  },
});
const defaultOptions = {
  include_docs: true, // eslint-disable-line camelcase
  conflicts: false,
  attachments: false,
};

let loopStart = Date.now();

const { index: mainIndex, client } = createAlgoliaIndex(c.indexName);
const { index: bootstrapIndex } = createAlgoliaIndex(c.bootstrapIndexName);
const stateManager = createStateManager(mainIndex);

async function main() {
  let start = Date.now();
  // first we make sure the bootstrap index has the correct settings
  log.info('💪  Setting up Algolia');
  await setSettings(bootstrapIndex);
  datadog.timing('main.init_algolia', Date.now() - start);

  // then we run the bootstrap
  // after a bootstrap is done, it's moved to main (with settings)
  // if it was already finished, we will set the settings on the main index
  start = Date.now();
  log.info('🗻  Bootstraping');
  await bootstrap(await stateManager.check());
  datadog.timing('main.bootsrap', Date.now() - start);

  // then we figure out which updates we missed since
  // the last time main index was updated
  start = Date.now();
  log.info('🚀  Launching Replicate');
  await replicate(await stateManager.get());
  datadog.timing('main.replicate', Date.now() - start);

  // then we watch 👀 for all changes happening in the ecosystem
  log.info('👀  Watching...');
  return watch(await stateManager.get());
}

main().catch(error);

async function setSettings(index) {
  await index.setSettings(c.indexSettings);
  await index.batchSynonyms(c.indexSynonyms, {
    replaceExistingSynonyms: true,
  });
  const { taskID } = await index.batchRules(c.indexRules, {
    replaceExistingRules: true,
  });

  return index.waitTask(taskID);
}

async function infoChange(seq, nbChanges, emoji) {
  const npmInfo = await npm.info();

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

async function logProgress(offset, nbDocs) {
  const { nbDocs: totalDocs } = await npm.info();

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

async function bootstrap(state) {
  await stateManager.save({
    stage: 'bootstrap',
  });

  if (state.seq > 0 && state.bootstrapDone === true) {
    await setSettings(mainIndex);
    log.info('☑️   Bootstrap: done');
    return state;
  }

  await loadHits();

  const { seq, nbDocs: totalDocs } = await npm.info();
  if (!state.bootstrapLastId) {
    // Start from 0
    log.info('⛷   Bootstrap: starting from the first doc');
    // first time this launches, we need to remember the last seq our bootstrap can trust
    await stateManager.save({ seq });
    await setSettings(bootstrapIndex);
  } else {
    log.info('⛷   Bootstrap: starting at doc %s', state.bootstrapLastId);
  }

  log.info('-----');
  log.info(`Total packages   ${totalDocs}`);
  log.info('-----');

  let still = true;
  while (still) {
    still = await loop(state.bootstrapLastId);
  }

  log.info('-----');
  log.info('☑️   Bootstrap: done');
  await stateManager.save({
    bootstrapDone: true,
    bootstrapLastDone: Date.now(),
  });

  return await moveToProduction();
}

async function loop(lastId) {
  const start = Date.now();
  log.info('loop()');

  const options =
    lastId === undefined
      ? {}
      : {
          startkey: lastId,
          skip: 1,
        };

  const res = await db.allDocs({
    ...defaultOptions,
    ...options,
    limit: c.bootstrapConcurrency,
  });

  // Nothing left to process
  if (res.rows.length <= 0) {
    return false;
  }

  datadog.increment('packages', res.rows.length);
  log.info('  - fetched', res.rows.length, 'packages');

  const newLastId = res.rows[res.rows.length - 1].id;

  const saved = await saveDocs({ docs: res.rows, index: bootstrapIndex });
  stateManager.save({
    bootstrapLastId: newLastId,
  });
  log.info(`  - saved ${saved} packages`);

  await logProgress(res.offset, res.rows.length);

  datadog.timing('loop', Date.now() - start);

  return newLastId;
}

async function moveToProduction() {
  log.info('🚚  starting move to production');

  const currentState = await stateManager.get();
  await client.copyIndex(c.bootstrapIndexName, c.indexName);

  await stateManager.save(currentState);
}

async function replicate({ seq }) {
  log.info(
    '🐌   Replicate: Asking for %d changes since sequence %d',
    c.replicateConcurrency,
    seq
  );

  await stateManager.save({
    stage: 'replicate',
  });

  const { seq: npmSeqToReach } = await npm.info();
  let npmSeqReached = false;

  return new Promise((resolve, reject) => {
    const changes = db.changes({
      ...defaultOptions,
      since: seq,
      batch_size: c.replicateConcurrency, // eslint-disable-line camelcase
      live: true,
      return_docs: false, // eslint-disable-line camelcase
    });

    const q = cargo(async docs => {
      datadog.increment('packages', docs.length);

      try {
        await saveDocs({ docs, index: mainIndex });
        await infoChange(docs[docs.length - 1].seq, 1, '🐌');
        await stateManager.save({
          seq: docs[docs.length - 1].seq,
        });
        return true;
      } catch (e) {
        return e;
      }
    }, c.replicateConcurrency);

    q.drain = () => {
      if (npmSeqReached) {
        log.info('🐌  We reached the npm current sequence');
        resolve();
      }
    };

    changes.on('change', async change => {
      if (change.deleted === true) {
        await mainIndex.deleteObject(change.id);
        log.info(`🐌  Deleted ${change.id}`);
      }

      q.push(change, err => {
        if (err) {
          reject(err);
        }
      });

      if (change.seq >= npmSeqToReach) {
        npmSeqReached = true;
        changes.cancel();
      }
    });
    changes.on('error', reject);
  });
}

async function watch({ seq }) {
  log.info(
    `🛰   Watch: 👍 We are in sync (or almost). Will now be 🔭 watching for registry updates, since ${seq}`
  );

  await stateManager.save({
    stage: 'watch',
  });

  return new Promise((resolve, reject) => {
    const changes = db.changes({
      ...defaultOptions,
      since: seq,
      live: true,
      batch_size: 1, // eslint-disable-line camelcase
      return_docs: false, // eslint-disable-line camelcase
    });

    const q = queue(async change => {
      datadog.increment('packages');

      try {
        await saveDocs({ docs: [change], index: mainIndex });
        await infoChange(change.seq, 1, '🛰');
        await stateManager.save({
          seq: change.seq,
        });
        const { bootstrapLastDone } = await stateManager.get();

        const now = Date.now();
        const lastBootstrapped = new Date(bootstrapLastDone);
        // when the process is running longer than a certain time
        // we want to start over and get all info again
        // we do this by exiting and letting Heroku start over
        if (now - lastBootstrapped > c.timeToRedoBootstrap) {
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

    changes.on('change', async change => {
      if (change.deleted === true) {
        await mainIndex.deleteObject(change.id);
        log.info(`🛰 Deleted ${change.id}`);
      }
      q.push(change, err => {
        if (err) {
          reject(err);
        }
      });
    });
    changes.on('error', reject);
  });
}

function error(err) {
  console.error(err); // eslint-disable-line no-console
  process.exit(1); // eslint-disable-line no-process-exit
}

import createStateManager from './createStateManager.js';
import saveDocs from './saveDocs.js';
import createAlgoliaIndex from './createAlgoliaIndex.js';
import c from './config.js';
import PouchDB from 'pouchdb-http';
import * as npm from './npm.js';
import log from './log.js';
import ms from 'ms';
import cargo from 'async/cargo';
import queue from 'async/queue';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

const db = new PouchDB(c.npmRegistryEndpoint, {
  ajax: {
    timeout: 30000, // default is 10s, but we have higher timeouts regularly
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

setSettings(mainIndex)
  .then(() => setSettings(bootstrapIndex))
  .then(() => stateManager.check())
  .then(bootstrap)
  .then(() => stateManager.get())
  .then(replicate)
  .then(() => stateManager.get())
  .then(watch)
  .catch(error);

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

function infoChange(seq, nbChanges, emoji) {
  return npm.info().then(npmInfo => {
    const ratePerSecond = nbChanges / ((Date.now() - loopStart) / 1000);
    const remaining = (npmInfo.seq - seq) / ratePerSecond * 1000 || 0;
    log.info(
      `${emoji} Synced %d/%d changes (%d%), current rate: %d changes/s (%s remaining)`,
      seq,
      npmInfo.seq,
      Math.floor(Math.max(seq, 1) / npmInfo.seq * 100),
      Math.round(ratePerSecond),
      ms(remaining)
    );
    loopStart = Date.now();
  });
}

function infoDocs(offset, nbDocs, emoji) {
  return npm.info().then(({ nbDocs: totalDocs }) => {
    const ratePerSecond = nbDocs / ((Date.now() - loopStart) / 1000);
    log.info(
      `${emoji} Synced %d/%d docs (%d%), current rate: %d docs/s (%s remaining)`,
      offset + nbDocs,
      totalDocs,
      Math.floor(Math.max(offset + nbDocs, 1) / totalDocs * 100),
      Math.round(ratePerSecond),
      ms((totalDocs - offset - nbDocs) / ratePerSecond * 1000)
    );
    loopStart = Date.now();
  });
}

async function bootstrap(state) {
  if (state.seq > 0 && state.bootstrapDone === true) {
    log.info('⛷ Bootstrap: done');
    return state;
  }

  if (state.bootstrapLastId) {
    log.info('⛷ Bootstrap: starting at doc %s', state.bootstrapLastId);
    return loop(state.bootstrapLastId);
  } else {
    await client.deleteIndex(c.bootstrapIndexName);
    log.info('⛷ Bootstrap: starting from the first doc');
    return (
      npm
        .info()
        // first time this launches, we need to remember the last seq our bootstrap can trust
        .then(({ seq }) =>
          stateManager.save({
            seq,
          })
        )
        .then(() => loop(state.bootstrapLastId))
    );
  }

  function loop(lastId) {
    const options =
      lastId === undefined
        ? {}
        : {
            startkey: lastId,
            skip: 1,
          };

    return db
      .allDocs({
        ...defaultOptions,
        ...options,
        limit: c.bootstrapConcurrency,
      })
      .then(async res => {
        if (res.rows.length === 0) {
          log.info('⛷ Bootstrap: done');
          await stateManager.save({
            bootstrapDone: true,
            bootstrapLastDone: Date.now(),
          });

          return moveToProduction();
        }

        const newLastId = res.rows[res.rows.length - 1].id;

        return saveDocs({ docs: res.rows, index: bootstrapIndex })
          .then(() =>
            stateManager.save({
              bootstrapLastId: newLastId,
            })
          )
          .then(() => infoDocs(res.offset, res.rows.length, '⛷'))
          .then(() => loop(newLastId));
      });
  }
}

async function moveToProduction() {
  log.info('🚚 starting move to production');
  await client.copyIndex(c.indexName, c.bootstrapIndexName, [
    'settings',
    'synonyms',
    'rules',
  ]);

  const currentState = await stateManager.get();
  await client.copyIndex(c.bootstrapIndexName, c.indexName);
  await stateManager.save(currentState);

  log.info('🗑 old bootstrap');
  await client.deleteIndex(c.bootstrapIndexName);
}

async function replicate({ seq }) {
  log.info(
    '🐌 Replicate: Asking for %d changes since sequence %d',
    c.replicateConcurrency,
    seq
  );

  const { seq: npmSeqToReach } = await npm.info();

  return new Promise((resolve, reject) => {
    const changes = db.changes({
      ...defaultOptions,
      since: seq,
      batch_size: c.replicateConcurrency, // eslint-disable-line camelcase
      live: true,
      return_docs: false, // eslint-disable-line camelcase
    });

    const q = cargo((docs, done) => {
      saveDocs({ docs, index: mainIndex })
        .then(() => infoChange(docs[docs.length - 1].seq, 1, '🐌'))
        .then(() =>
          stateManager.save({
            seq: docs[docs.length - 1].seq,
          })
        )
        .then(({ seq: lastDocSeq }) => {
          if (lastDocSeq >= npmSeqToReach) {
            log.info('🐌 We reached the npm current sequence');
            changes.cancel();
          }
        })
        .then(done)
        .catch(done);
    }, c.replicateConcurrency);

    changes.on('change', async change => {
      if (change.deleted === true) {
        await mainIndex.deleteObject(change.id);
        log.info(`🐌 Deleted ${change.id}`);
      }

      q.push(change, err => {
        if (err) {
          reject(err);
        }
      });
    });
    changes.on('complete', resolve); // Called when cancel() called
    changes.on('error', reject);
  });
}

function watch({ seq }) {
  log.info(
    `🛰 Watch: 👍 We are in sync (or almost). Will now be 🔭 watching for registry updates, since ${seq}`
  );

  return new Promise((resolve, reject) => {
    const changes = db.changes({
      ...defaultOptions,
      since: seq,
      live: true,
      batch_size: 1, // eslint-disable-line camelcase
      return_docs: false, // eslint-disable-line camelcase
    });

    const q = queue((change, done) => {
      saveDocs({ docs: [change], index: mainIndex })
        .then(() => infoChange(change.seq, 1, '🛰'))
        .then(() =>
          stateManager.save({
            seq: change.seq,
          })
        )
        .then(stateManager.get)
        .then(({ bootstrapLastDone }) => {
          const now = Date.now();
          const lastBootstrapped = new Date(bootstrapLastDone);
          // when the process is running longer than a certain time
          // we want to start over and get all info again
          // we do this by exiting and letting Heroku start over
          if (now - lastBootstrapped > c.timeToRedoBootstrap) {
            return stateManager
              .set({
                seq: 0,
                bootstrapDone: false,
              })
              .then(() => {
                process.exit(0); // eslint-disable-line no-process-exit
              });
          }

          return null;
        })
        .then(done)
        .catch(done);
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

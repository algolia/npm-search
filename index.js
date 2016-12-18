import stateManager from './stateManager.js';
import saveChanges from './saveChanges.js';
import c from './config.js';
import PouchDB from 'pouchdb';
import npm from './npm.js';
import log from './log.js';

log.info('🗿 npm ↔️ Algolia replication starts 🛰');

const db = new PouchDB(c.npmRegistryEndpoint);
const defaultOptions = {
  since: c.seq,
  limit: c.concurrency,
  include_docs: true, // eslint-disable-line camelcase
  conflicts: false,
  attachments: false,
};

let loopStart = Date.now();

stateManager
  .check()
  .then(state => info(state, 0))
  .then(replicate)
  .then(watch)
  .catch(error);

function info(state, nbChanges) {
  return npm
    .info()
    .then(npmInfo => {
      log.info(
        'Replicated %d/%d changes (%d%), current rate: %d changes/s',
        state.seq,
        npmInfo.seq,
        Math.floor(Math.max(state.seq, 1) / npmInfo.seq * 100),
        Math.round(nbChanges / ((Date.now() - loopStart) / 1000))
      );
      loopStart = Date.now();
      return state;
    });
}

function replicate({seq}) {
  log.info('Asking for %d changes since sequence %d', c.concurrency, seq);

  return db
    .changes({
      ...defaultOptions,
      since: seq,
    })
    .then(res =>
      saveChanges(seq, res.results)
      .then(() => stateManager.save({seq: res.last_seq}))
      .then(() => info({seq: res.last_seq}, res.results.length))
      .then(() => {
        if (res.results.length < c.concurrency) {
          return {seq: res.last_seq};
        }

        return replicate({seq: res.last_seq});
      })
    );
}

function watch({seq}) {
  log.info('👍 We are in sync (or almost). Will now be 🔭 watching for registry updates');

  return new Promise((resolve, reject) => {
    let chain = Promise.resolve();
    const changes = db.changes({
      ...defaultOptions,
      since: seq,
      live: true,
      limit: undefined,
    });

    changes.on('change', change => {
      chain = chain.then(() => saveChanges(change.seq, [change]).catch(reject));
    });
    changes.on('error', reject);
  });
}

function error(err) {
  console.error(err); // eslint-disable-line no-console
  process.exit(1); // eslint-disable-line no-process-exit
}

import queue from 'async/queue.js';
import ms from 'ms';

import { config } from './config';
import * as npm from './npm';
import saveDocs from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';

let loopStart = Date.now();
let totalSequence; // Cached npmInfo.seq

/**
 * Run watch and catchup.
 *
 *  --- Catchup ?
 *   If the bootstrap is long or the process has been stopped long enough,
 *   we are lagging behind few changes.
 *   Catchup() will paginate through changes that we have missed.
 *
 *  --- Watch ?
 *   Watch is "Long Polled. This mode is not paginated and the event system in CouchDB send
 *     events as they arrive, which is super cool and reactive.
 *   One gotcha those events arrive at the same rate wether you are watching the last seq or not.
 *
 *   Example:
 *    listener A - up to date
 *    listener B - few sequences behind.
 *
 *    Package C is updated.
 *
 *    Listener A receive update C
 *    listener B receive update N.
 *
 *    Listener A is up to date again
 *    listener B is still few sequences behind and will not receive any other event
 *      until an other package is updated.
 *      It will never be up to date because he receive event at the same pace
 *      as they arrive in listener A, even if it's not the same package.
 *
 *
 *  --- We could use catchup with a timeout between poll then?
 *   Yes !
 *   When we are catched up, we could await between poll and we will receive N changes.
 *   But long-polling is more efficient in term of bandwidth and more reactive.
 */
async function run(stateManager, mainIndex) {
  await stateManager.save({
    stage: 'watch',
  });

  await catchup(stateManager, mainIndex);

  log.info('🚀  Index is up to date, watch mode activated');

  await watch(stateManager, mainIndex);

  log.info('🚀  watch is done');
}

/**
 * Loop through all changes that may have been missed.
 *
 * @param {object} stateManager - The state manager.
 * @param {object} mainIndex - Algolia index manager.
 */
async function catchup(stateManager, mainIndex) {
  let hasCaughtUp = false;
  while (!hasCaughtUp) {
    loopStart = Date.now();

    try {
      const npmInfo = await npm.getInfo();
      totalSequence = npmInfo.seq;

      const { seq } = await stateManager.get();
      log.info(
        '🚀  Catchup: Asking for %d changes since sequence %d',
        config.replicateConcurrency,
        seq
      );

      // Get one chunk of changes from registry
      const changes = await npm.getChanges({
        since: seq,
        limit: config.replicateConcurrency,
        include_docs: true,
      });
      hasCaughtUp = await loop(stateManager, mainIndex, changes);
    } catch (err) {
      sentry.report(err);
    }
  }
}

/**
 * Active synchronous mode with Registry.
 * Changes are polled with a keep-alived connection.
 *
 * @param {object} stateManager - The state manager.
 * @param {object} mainIndex - Algolia index manager.
 */
async function watch(stateManager, mainIndex) {
  const { seq } = await stateManager.get();
  const listener = npm.listenToChanges({
    since: seq,
    include_docs: false,
    heartbeat: 30 * 1000,
    limit: 100,
  });

  /**
   * Queue is ensuring we are processing changes ordered
   * This also means we can not process more than 1 at the same time.
   *
   * --- Why ?
   *   CouchDB send changes in an ordered fashion
   *     Event A update package C
   *     Event B delete package C.
   *
   *     If the events are not processed in the same order, you can have a broken state.
   */
  const changesConsumer = queue(async (change) => {
    log.info('Processing... still in queue', changesConsumer._tasks.length);
    try {
      const doc = !change.deleted
        ? (await npm.getDocs({ keys: [change.id] })).rows[0]
        : null;

      if (!doc) {
        log.warn('Could not find doc', doc, change);
        return;
      }

      await loop(
        stateManager,
        mainIndex,
        { results: [doc], last_seq: change.seq },
        change.seq
      );
    } catch (err) {
      sentry.report(err);
    }
  }, 1);

  listener.on('change', (change) => {
    log.info(
      'we received 1 change',
      change.seq,
      '; in queue',
      changesConsumer._tasks.length
    );
    totalSequence = change.seq;
    if (!change.id) {
      // Can happen when NPM send an empty line (for example the hearthbeat) 🤷🏻‍
      log.info('Change is null', change);
      return;
    }
    changesConsumer.push(change);
  });

  listener.on('error', (err) => {
    sentry.report(err);
  });

  listener.follow();

  return new Promise((resolve) => {
    listener.on('stop', () => {
      resolve();
    });
  });
}

/**
 * Process changes.
 */
async function loop(stateManager, mainIndex, changes) {
  const start = Date.now();
  datadog.increment('packages', changes.results.length);
  const names = changes.results.map((change) => change.id);
  log.info(`🚀  Received ${changes.results.length} packages`, names.join(','));

  // eslint-disable-next-line no-param-reassign
  changes.results = changes.results.filter((change) => {
    if (change.deleted) {
      // Delete package directly in index
      // Filter does not support async/await but there is no concurrency issue with this
      mainIndex.deleteObject(change.id);
      log.info(`🚀  Deleted ${change.id}`);
    }
    return !change.deleted;
  });

  await saveDocs({ docs: changes.results, index: mainIndex });

  await stateManager.save({
    seq: changes.last_seq,
  });

  logProgress(changes.last_seq, changes.results.length);

  datadog.timing('watch.loop', Date.now() - start);
  return changes.last_seq >= totalSequence;
}

/**
 * Log our process through catchup/watch.
 *
 * @param {number} seq - The current number of changes we have reached.
 * @param {number} nbChanges - Number of changes processed in this batch.
 */
function logProgress(seq, nbChanges) {
  const ratePerSecond = nbChanges / ((Date.now() - loopStart) / 1000);
  const remaining = ((totalSequence - seq) / ratePerSecond) * 1000 || 0;

  log.info(
    `🚀  Synced %d/%d changes (%d%), current rate: %d changes/s (%s remaining)`,
    seq,
    totalSequence,
    Math.floor((Math.max(seq, 1) / totalSequence) * 100),
    Math.round(ratePerSecond),
    ms(remaining)
  );
}

export { run };

import ms from 'ms';
import queue from 'async/queue.js';

import config from './config.js';
import datadog from './datadog.js';
import log from './log.js';
import * as npm from './npm/index.js';
import saveDocs from './saveDocs.js';
import * as sentry from './utils/sentry.js';

let loopStart;

/**
 * Run watch and catchup
 *
 *  --- Catchup ?
 *   If the bootstrap is long or the process has been stopped long enough,
 *   we are lagging behind few changes.
 *   catchup() will paginate through changes that we have missed.
 *
 *  --- Watch ?
 *   Watch is "Long Polled. This mode is not paginated and the event system in CouchDB send
 *     events as they arrive, which is super cool and reactive.
 *   One gotcha those events arrive at the same rate wether you are watching the last seq or not.
 *
 *   Example:
 *    listener A - up to date
 *    listener B - few sequences behind
 *
 *    package C is updated
 *
 *    listener A receive update C
 *    listener B receive update N
 *
 *    listener A is up to date again
 *    listener B is still few sequences behind and will not receive any other event
 *      until an other package is updated.
 *      It will never be up to date because he receive event at the same pace
 *      as they arrive in listener A, even if it's not the same package
 *
 *
 *  --- We could use catchup with a timeout between poll then?
 *   yes !
 *   When we are catched up, we could await between poll and we will receive N changes.
 *   But long-polling is more efficient in term of bandwidth and more reactive.
 */
async function run(stateManager, mainIndex) {
  await stateManager.save({
    stage: 'watch',
  });

  await catchup(stateManager, mainIndex);

  log.info('🚀  Replicate is up to date, synchronous mode activated');

  await watch(stateManager, mainIndex);
}

/**
 * Loop through all changes that may have been missed
 *
 * @param {object} stateManager The state manager
 * @param {object} mainIndex Algolia index manager
 */
async function catchup(stateManager, mainIndex) {
  let hasCaughtUp = false;
  while (!hasCaughtUp) {
    loopStart = Date.now();

    try {
      const { seq: totalSequence } = await npm.getInfo();
      const { seq } = await stateManager.get();
      log.info(
        '🚀  Replicate: Asking for %d changes since sequence %d',
        config.replicateConcurrency,
        seq
      );

      // Get one chunk of changes from registry
      const changes = await npm.getChanges({
        since: seq,
        limit: config.replicateConcurrency,
        include_docs: true, // eslint-disable-line camelcase
      });
      hasCaughtUp = await loop(stateManager, mainIndex, changes, totalSequence);
    } catch (err) {
      sentry.report(err);
    }
  }
}

/**
 * Active synchronous mode with Registry
 * Changes are polled with a keep-alived connection
 *
 * @param {object} stateManager The state manager
 * @param {object} mainIndex Algolia index manager
 */
async function watch(stateManager, mainIndex) {
  const { seq } = await stateManager.get();
  const listener = npm.listenToChanges({
    since: seq,
    include_docs: true, // eslint-disable-line camelcase
    heartbeat: 90 * 1000,
  });

  /**
   * Queue is ensuring we are processing changes ordered
   * This also means we can not process more than 1 at the same time
   *
   * --- Why ?
   *   CouchDB send changes in an ordered fashion
   *     Event A update package C
   *     Event B delete package C
   *
   *     If the events are not processed in the same order, you can have a broken state
   */
  const changesConsumer = queue(async change => {
    try {
      await loop(
        stateManager,
        mainIndex,
        // eslint-disable-next-line camelcase
        { results: [change], last_seq: change.seq },
        change.seq
      );
    } catch (err) {
      sentry.report(err);
    }
  }, 1);

  listener.on('change', change => {
    changesConsumer.push(change);
  });

  listener.on('error', err => {
    sentry.report(err);
  });

  listener.follow();
}

/**
 * Process changes
 */
async function loop(stateManager, mainIndex, changes, totalSequence) {
  const start = Date.now();
  datadog.increment('packages', changes.results.length);
  const names = changes.results.map(change => change.doc && change.doc.name);
  log.info(`🚀  Replicate received ${changes.results.length} packages`, names);

  // Delete package directly in index
  await Promise.all(
    changes.results.map(async change => {
      if (change.deleted) {
        await mainIndex.deleteObject(change.id);
        log.info(`🚀  Deleted ${change.id}`);
      }
    })
  );

  await saveDocs({ docs: changes.results, index: mainIndex });

  await stateManager.save({
    seq: changes.last_seq,
  });

  logProgress(totalSequence, changes.last_seq, changes.results.length);

  datadog.timing('watch.loop', Date.now() - start);
  return changes.last_seq >= totalSequence;
}

/**
 * Log our process through catchup/watch
 *
 * @param {number} totalSequence The current number of changes in Registry
 * @param {number} seq The current number of changes we have reached
 * @param {number} nbChanges Number of changes processed in this batch
 */
function logProgress(totalSequence, seq, nbChanges) {
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

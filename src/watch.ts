import type { SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';
import ms from 'ms';
import type { DatabaseChangesResultItem, DocumentLookupFailure } from 'nano';

import type { StateManager } from './StateManager';
import { config } from './config';
import * as npm from './npm';
import saveDocs from './saveDocs';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';

let loopStart = Date.now();
let totalSequence: number; // Cached npmInfo.seq
let changesConsumer: QueueObject<DatabaseChangesResultItem>;

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
async function run(
  stateManager: StateManager,
  mainIndex: SearchIndex
): Promise<void> {
  await stateManager.save({
    stage: 'watch',
  });

  changesConsumer = createChangeConsumer(stateManager, mainIndex);

  await catchup(stateManager);

  log.info('🚀  Index is up to date, watch mode activated');

  await watch(stateManager);

  log.info('🚀  watch is done');
}

/**
 * Loop through all changes that may have been missed.
 */
async function catchup(stateManager: StateManager): Promise<void> {
  let hasCaughtUp: boolean = false;

  while (!hasCaughtUp) {
    loopStart = Date.now();

    try {
      const npmInfo = await npm.getInfo();
      totalSequence = npmInfo.seq;

      const { seq } = await stateManager.get();

      log.info('🚀  Catchup: continue since sequence [%d]', seq);

      // Get one chunk of changes from registry
      const changes = await npm.getChanges({
        since: seq,
        limit: config.replicateConcurrency,
        include_docs: true,
      });

      log.info(changes);

      for (const change of changes.results) {
        changesConsumer.push(change);
      }
      await changesConsumer.drain();

      const newState = await stateManager.get();
      if (newState.seq! >= totalSequence) {
        hasCaughtUp = true;
      }
    } catch (err) {
      sentry.report(err);
    }
  }
}

/**
 * Active synchronous mode with Registry.
 * Changes are polled with a keep-alived connection.
 *
 * @param stateManager - The state manager.
 * @param mainIndex - Algolia index manager.
 */
async function watch(stateManager: StateManager): Promise<true> {
  const { seq } = await stateManager.get();

  const listener = npm.listenToChanges({
    since: String(seq),
    include_docs: false,
    heartbeat: 30 * 1000,
  });

  listener.on('change', (change) => {
    totalSequence = change.seq;

    changesConsumer.push(change);
  });

  listener.on('error', (err) => {
    sentry.report(err);
  });

  listener.follow();

  return new Promise((resolve) => {
    listener.on('stop', () => {
      resolve(true);
    });
  });
}

/**
 * Process changes.
 */
async function loop(
  mainIndex: SearchIndex,
  change: DatabaseChangesResultItem
): Promise<void> {
  const start = Date.now();
  datadog.increment('packages');

  if (!change.id) {
    // Can happen when NPM send an empty line (for example the hearthbeat) 🤷🏻‍
    log.error('Got a document without name', change);
    return;
  }

  if (change.deleted) {
    // Delete package directly in index
    // Filter does not support async/await but there is no concurrency issue with this
    mainIndex.deleteObject(change.id);
    log.info(`🚀  Deleted ${change.id}`);
    return;
  }

  const doc = (await npm.getDocs({ keys: [change.id] })).rows[0];

  if (isFailure(doc)) {
    log.error('Got an error', doc.error);
    return;
  }

  await saveDocs({ docs: [doc], index: mainIndex });

  datadog.timing('watch.loop', Date.now() - start);
}

/**
 * Log our process through catchup/watch.
 *
 */
function logProgress(seq: number, nbChanges: number): void {
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
function createChangeConsumer(
  stateManager: StateManager,
  mainIndex: SearchIndex
): QueueObject<DatabaseChangesResultItem> {
  return queue<DatabaseChangesResultItem>(async (change) => {
    const seq = change.seq;
    log.info(`🚀  Received change [%s]`, seq);
    try {
      await loop(mainIndex, change);
      await stateManager.save({
        seq,
      });
      logProgress(seq, 1);
    } catch (err) {
      sentry.report(err);
    }
  }, 1);
}

function isFailure(change: any): change is DocumentLookupFailure {
  return change.error && !change.id;
}

export { run };

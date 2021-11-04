/* eslint-disable no-process-exit */
import { nextTick } from 'async';

import { StateManager } from './StateManager';
import * as algolia from './algolia/index';
import { createAPI } from './api';
import { Bootstrap } from './bootstrap';
import { config } from './config';
import * as jsDelivr from './jsDelivr/index';
import * as typescript from './typescript/index';
import { datadog } from './utils/datadog';
import { log } from './utils/log';
import * as sentry from './utils/sentry';
import { Watch } from './watch';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

const KILL_PROCESS_EVERY_MS = 1 * 60 * 60 * 1000; // every 1 hours

/**
 * Main process
 *   - Bootstrap: will index the whole list of packages (if needed)
 *   - Watch    : will process update in real time.
 */
async function main(): Promise<void> {
  const start = Date.now();

  // We schedule to kill the process:
  //  - reset cache
  //  - maybe retrigger bootstrap
  setTimeout(() => {
    log.info('👋  Scheduled process cleaning');
    process.exit(0);
  }, KILL_PROCESS_EVERY_MS);

  createAPI();

  // first we make sure the bootstrap index has the correct settings
  log.info('💪  Setting up Algolia', config.appId, [
    config.bootstrapIndexName,
    config.indexName,
  ]);
  const {
    client: algoliaClient,
    mainIndex,
    bootstrapIndex,
  } = await algolia.prepare(config);
  datadog.timing('main.init_algolia', Date.now() - start);

  // Create State Manager that holds progression of indexing
  const stateManager = new StateManager(mainIndex);

  // Preload some useful data
  await jsDelivr.loadHits();
  await typescript.loadTypesIndex();

  const bootstrap = new Bootstrap(
    stateManager,
    algoliaClient,
    mainIndex,
    bootstrapIndex
  );
  const watch = new Watch(stateManager, mainIndex);

  // then we run the bootstrap
  // after a bootstrap is done, it's moved to main (with settings)
  // if it was already finished, we will set the settings on the main index
  await bootstrap.run();

  // then we figure out which updates we missed since
  // the last time main index was updated
  await watch.run();
}

main().catch(async (err) => {
  sentry.report(err);
  await sentry.drain();
  process.exit(1);
});

async function close(): Promise<void> {
  log.info('Close was requested');
  await sentry.drain();

  nextTick(() => {
    process.exit(1);
  });
}

process.once('SIGINT', async () => {
  await close();
});

process.once('SIGTERM', async () => {
  await close();
});

process.on('unhandledRejection', async (reason) => {
  sentry.report(reason);
  await close();
});

// Report any uncaught exception, without letting the process crash
process.on('uncaughtException', (err) => {
  sentry.report(err, { context: 'uncaughtException' });
});

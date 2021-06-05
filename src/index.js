import * as algolia from './algolia/index.js';
import * as bootstrap from './bootstrap.js';
import { config } from './config.ts';
import createStateManager from './createStateManager.js';
import datadog from './datadog.js';
import * as jsDelivr from './jsDelivr/index.js';
import log from './log.js';
import * as sentry from './utils/sentry.js';
import * as watch from './watch.js';

log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰');

const KILL_PROCESS_EVERY_MS = 12 * 60 * 60 * 1000; // every 12 hours

/**
 * Main process
 *   - Bootstrap: will index the whole list of packages (if needed)
 *   - Watch    : will process update in real time.
 */
async function main() {
  const start = Date.now();

  // We schedule to kill the process:
  //  - reset cache
  //  - maybe retrigger bootstrap
  setTimeout(() => {
    log.info('👋  Scheduled process cleaning');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }, KILL_PROCESS_EVERY_MS);

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
  await bootstrap.run(stateManager, algoliaClient, mainIndex, bootstrapIndex);

  // then we figure out which updates we missed since
  // the last time main index was updated
  log.info('🚀  Launching Watch');
  await watch.run(stateManager, mainIndex);
}

main().catch(async (err) => {
  sentry.report(err);
  await sentry.drain();
  process.exit(1); // eslint-disable-line no-process-exit
});

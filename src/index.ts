import 'elastic-apm-node/start';

/* eslint-disable no-process-exit */
import type http from 'http';

import { nextTick } from 'async';

import { version } from '../package.json';

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

const KILL_PROCESS_EVERY_MS = 1 * 60 * 60 * 1000; // every 1 hours

class Main {
  bootstrap: Bootstrap | undefined;
  watch: Watch | undefined;
  healthApi: http.Server | undefined;

  async run(): Promise<void> {
    log.info('🗿 npm ↔️ Algolia replication starts ⛷ 🐌 🛰', { version });
    let start = Date.now();

    // We schedule to kill the process:
    //  - reset cache
    //  - maybe retrigger bootstrap
    setTimeout(() => {
      log.info('👋  Scheduled process cleaning');
      close();
    }, KILL_PROCESS_EVERY_MS);

    this.healthApi = createAPI();

    // first we make sure the bootstrap index has the correct settings
    start = Date.now();

    log.info('💪  Setting up Algolia', config.appId, [
      config.bootstrapIndexName,
      config.indexName,
    ]);
    const algoliaStore = await algolia.prepare(config);
    datadog.timing('main.init_algolia', Date.now() - start);

    // Create State Manager that holds progression of indexing
    const stateManager = new StateManager(algoliaStore.mainIndex);

    // Preload some useful data
    await jsDelivr.loadHits();
    await typescript.loadTypesIndex();
    this.bootstrap = new Bootstrap(stateManager, algoliaStore);
    this.watch = new Watch(stateManager, algoliaStore);

    if (!(await this.bootstrap.isDone())) {
      this.bootstrap.on('finished', async () => {
        await this.watch!.run();
      });

      // then we run the bootstrap
      // after a bootstrap is done, it's moved to main (with settings)
      // if it was already finished, we will set the settings on the main index
      await this.bootstrap.run();
    } else {
      await this.watch.run();
    }
  }

  async stop(): Promise<void> {
    if (this.bootstrap) {
      await this.bootstrap.stop();
    }
    if (this.watch) {
      await this.watch.stop();
    }
    if (this.healthApi) {
      await new Promise((resolve) => {
        this.healthApi!.close(resolve);
      });
    }
    log.info('Stopped Main gracefully');
  }
}

const main = new Main();

process.on('unhandledRejection', (err) => {
  sentry.report(new Error('unhandledRejection'), { err });
  close();
});
process.on('uncaughtException', (err) => {
  sentry.report(new Error('uncauthexception'), { err });
});

(async (): Promise<void> => {
  try {
    await main.run();
  } catch (err) {
    sentry.report(new Error('Error during run'), { err });
    close();
  }
})();

async function close(): Promise<void> {
  log.info('Close was requested');
  setTimeout(() => {
    // grace period in case a lot of jobs are pending
    process.exit(1);
  }, 90000);

  // datadog.close();
  await sentry.drain();
  await main.stop();

  nextTick(() => {
    process.exit(0);
  });
}

process.once('SIGINT', async () => {
  await close();
});

process.once('SIGTERM', async () => {
  await close();
});

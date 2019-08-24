import log from './../log.js';
import wait from './../utils/wait.js';

import * as api from './index.js';

class PackagesFetcher {
  limit = 100;
  max = 1000;
  total = 0;
  storage = [];
  stateManager;
  nextKey = null;

  lastPrefetchOffset = 0;
  nextOffset = 0;
  prefetching = 0;

  constructor({ limit = 100, max = 1000, nextKey = null }, stateManager) {
    this.limit = limit;
    this.max = max;
    this.nextKey = nextKey;

    this.stateManager = stateManager;
  }

  /**
   * Tell if we finished fetching
   *
   * @returns {boolean} true if we finished fetching all packages
   */
  get isFinished() {
    return (
      this.stateManager.seq > 0 &&
      this.stateManager.bootstrapDone === true &&
      this.storage.length === 0 &&
      this.lastPrefetchOffset >= this.total
    );
  }

  get actualOffset() {
    return Math.max(0, this.nextOffset - this.limit);
  }

  /**
   * Launch prefetching
   */
  async launch({ prefetch = true }) {
    const count = prefetch ? Math.min(5, Math.ceil(this.max / this.limit)) : 1;

    log.info(`Prefetching ${count} pages of packages`);
    for (let index = 0; index < count; index++) {
      await this.prefetch();
      if (count > 1) {
        log.info(' prefetched page:', index + 1);
      }
    }
  }

  /**
   * Prefetch
   */
  async prefetch() {
    if (this.storage.length >= this.max || this.prefetching) {
      return;
    }

    this.prefetching = true;
    const options = {
      limit: this.limit,
    };

    if (this.nextKey) {
      options.startkey = this.nextKey;
      options.skip = 1;
    }

    try {
      const { rows: packages, offset } = await api.findAll(options);
      this.lastPrefetchOffset = offset;
      if (packages.length <= 0) {
        await this.syncTotalWithNPM();
        this.prefetching = false;
        return;
      }

      this.nextKey = packages[packages.length - 1].id;

      this.storage.push(...packages);
      log.debug(
        `⬇️  Prefteched ${packages.length} rows, offset now at ${this.lastPrefetchOffset} "${this.nextKey}"`
      );
    } catch (e) {
      log.error(e);
    }

    this.prefetching = false;
    // Add in next stack a call to continue to prefetch
    setImmediate(() => this.prefetch());
  }

  async syncTotalWithNPM() {
    const { nbDocs: totalDocs } = await api.getInfo();
    this.total = totalDocs;
  }

  async syncOffset() {
    const options = {
      limit: 1,
    };

    if (this.nextKey) {
      options.startkey = this.nextKey;
    }
    const { rows: packages, offset } = await api.findAll(options);

    if (this.nextKey) {
      this.nextOffset = offset;
      if (packages.length <= 0) {
        return;
      }
      this.nextKey = packages[packages.length - 1].id;
    }
  }

  /**
   * Get next batch from memory storage
   */
  async get() {
    if (this.storage.length <= 0) {
      if (this.isFinished) {
        return null;
      }

      while (this.storage.length <= 0 || !this.isFinished) {
        log.warn('🥴  We process packages faster than we prefetch them');
        await this.prefetch();
        await wait(5000);
      }
    }

    const packages = this.storage.splice(0, this.limit);

    this.nextOffset += packages.length;
    return packages;
  }
}

export default PackagesFetcher;

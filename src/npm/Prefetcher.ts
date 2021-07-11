import type { DocumentListParams } from 'nano';

import { config } from '../config';
import { log } from '../utils/log';
import { wait } from '../utils/wait';

import type { GetPackage } from './types';

import * as npm from './index';

export class Prefetcher {
  #limit: number = config.bootstrapConcurrency;
  #ready: GetPackage[] = [];
  #nextKey: string | null = null;
  #running: boolean = false;
  #offset: number = 0;
  #finished: boolean = false;

  constructor(opts: { nextKey: string | null }) {
    this.#nextKey = opts.nextKey;
  }

  get offset(): number {
    return this.#offset;
  }

  get isFinished(): boolean {
    return this.#finished;
  }

  async getNext(): Promise<GetPackage> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.#ready.length <= 0) {
        await wait(100);
        // eslint-disable-next-line no-continue
        continue;
      }

      return this.#ready.shift()!;
    }
  }

  async launch(): Promise<void> {
    this.#running = true;
    while (this.#running) {
      await this.fetchOnePage();

      await wait(5000);
    }
  }

  private async fetchOnePage(): Promise<void> {
    const options: Partial<DocumentListParams> = {
      limit: this.#limit,
      include_docs: false,
    };

    if (this.#nextKey) {
      options.startkey = this.#nextKey;
      options.skip = 1;
    }
    const { rows: packages, offset } = await npm.findAll(options);
    this.#offset = offset;

    if (packages.length <= 0) {
      this.#finished = true;
      this.#running = false;
      return;
    }

    log.info('  - [pf] received', packages.length, 'packages');

    this.#nextKey = packages[packages.length - 1].id;
  }
}

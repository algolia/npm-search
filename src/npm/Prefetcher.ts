import type { DocumentListParams, DocumentResponseRow } from 'nano';

import { config } from '../config';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';
import { wait } from '../utils/wait';

import type { GetPackage } from './types';

import * as npm from './index';

export type PrefetchedPkg = Pick<
  DocumentResponseRow<GetPackage>,
  'id' | 'value'
>;

export class Prefetcher {
  #limit: number = config.bootstrapConcurrency;
  #ready: PrefetchedPkg[] = [];
  #nextKey: string | null = null;
  #running: boolean = false;
  #offset: number = 0;
  #finished: boolean = false;
  #maxIdle = config.prefetchMaxIdle;

  constructor(opts: { nextKey: string | null }) {
    this.#nextKey = opts.nextKey;
  }

  get offset(): number {
    return this.#offset + this.#limit - this.#ready.length;
  }

  get idleCount(): number {
    return this.#ready.length;
  }

  get isFinished(): boolean {
    return this.#finished;
  }

  async getNext(): Promise<PrefetchedPkg> {
    while (this.#ready.length <= 0) {
      await wait(100);
    }

    return this.#ready.shift()!;
  }

  async launch(): Promise<void> {
    this.#running = true;
    while (this.#running) {
      if (this.#ready.length >= this.#maxIdle) {
        await wait(config.prefetchWaitBetweenPage);
        continue;
      }

      await this.fetchOnePage();
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
    try {
      const { rows: packages, offset } = await npm.findAll(options);

      if (packages.length <= 0) {
        this.#finished = true;
        this.#running = false;
        this.#offset = offset;
        log.info('[pf] done');
        return;
      }

      this.#ready.push(...packages);
      this.#offset = offset;
      this.#nextKey = packages[packages.length - 1]!.id;
    } catch (err) {
      sentry.report(err);
    }
  }
}

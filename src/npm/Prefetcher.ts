import { setTimeout } from 'node:timers/promises';

import type { SearchIndex } from 'algoliasearch';
import ms from 'ms';
import type { DocumentListParams, DocumentResponseRow } from 'nano';

import type { StateManager } from '../StateManager';
import { config } from '../config';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';

import type { GetPackage } from './types';

import * as npm from './index';

export type PrefetchedPkg = Pick<
  DocumentResponseRow<GetPackage>,
  'id' | 'value'
> & { offset: number };

export class Prefetcher {
  private stateManager: StateManager;
  private queueIndex: SearchIndex;

  #limit: number = config.bootstrapConcurrency;
  #ready: PrefetchedPkg[] = [];

  #nextKey: string | null = null;
  #running: boolean = false;
  #offset: number = 0;
  #finished: boolean = false;

  constructor(
    stateManager: StateManager,
    queueIndex: SearchIndex,
    opts: { nextKey: string | null }
  ) {
    this.stateManager = stateManager;
    this.queueIndex = queueIndex;
    this.#nextKey = opts.nextKey;
  }

  stop(): void {
    this.#running = false;
  }

  get offset(): number {
    return this.#offset + this.#limit - this.#ready.length;
  }

  get isFinished(): boolean {
    return this.#finished;
  }

  run(): void {
    this.#running = true;

    this.runInternal().catch((e) => {
      sentry.report(e);
    });
  }

  async runInternal(): Promise<void> {
    while (this.#running) {
      await this.queueOnePage();
      await setTimeout(ms('1 second'));
    }
  }

  private async queueOnePage(): Promise<void> {
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

      await this.queueIndex.saveObjects(
        packages.map((pkg) => ({
          name: pkg.id,
          objectID: pkg.id,
          retries: 0,
          pkg,
        }))
      );

      const lastId = (await this.stateManager.get()).bootstrapLastId;
      const pkg = packages.at(-1);

      if (pkg && (!lastId || lastId < pkg.id)) {
        await this.stateManager.save({
          bootstrapLastId: pkg.id,
        });
      }

      this.#offset = offset;
      this.#nextKey = packages[packages.length - 1]!.id;
    } catch (err: any) {
      sentry.report(err);

      if (err.statusCode === 429) {
        log.info('[pf] waiting');
        await setTimeout(ms('2 minutes'));
      }
    }
  }
}

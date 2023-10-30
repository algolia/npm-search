import { setTimeout } from 'node:timers/promises';

import type { SearchIndex } from 'algoliasearch';
import chalk from 'chalk';
import type { DebouncedFunc } from 'lodash';
import _ from 'lodash';
import ms from 'ms';
import PQueue from 'p-queue';

import type { AlgoliaStore } from '../algolia';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';

export abstract class Indexer<TMainRecord, TTask = TMainRecord> {
  protected mainIndex: SearchIndex;
  protected algoliaStore: AlgoliaStore;

  private recordQueue: PQueue;
  private recordsQueueConcurrency: number = 240;

  private taskQueue: PQueue;
  private taskQueueConcurrency: number = 120;

  private isRunning: boolean = false;
  private readonly throttledFetchFacets: DebouncedFunc<() => Promise<string[]>>;

  protected abstract readonly facetField: string;

  get facetFilter(): string | undefined {
    return undefined;
  }

  get queued(): number {
    return this.taskQueue.size;
  }

  get running(): number {
    return this.taskQueue.pending;
  }

  constructor(algoliaStore: AlgoliaStore, mainIndex: SearchIndex) {
    this.mainIndex = mainIndex;
    this.algoliaStore = algoliaStore;

    this.throttledFetchFacets = _.throttle(
      () => this.fetchFacets().catch(() => []),
      ms('1 minute')
    );

    this.recordQueue = new PQueue({
      concurrency: this.recordsQueueConcurrency,
    });

    this.taskQueue = new PQueue({
      concurrency: this.taskQueueConcurrency,
    });
  }

  async fetchFacets(): Promise<string[]> {
    const result = await this.mainIndex.search('', {
      filters: this.facetFilter,
      facets: [this.facetField],
      hitsPerPage: 0,
      maxValuesPerFacet: 1000,
      sortFacetValuesBy: 'alpha',
    });

    if (!result.facets) {
      log.error('Wrong results from Algolia');
      return [];
    }

    return Object.keys(result.facets[this.facetField] || {}).sort();
  }

  async *fetchRecords(): AsyncGenerator<TMainRecord[]> {
    const facets = await this.throttledFetchFacets();

    if (!facets?.length) {
      return [];
    }

    for (const facet of facets) {
      let cursor;

      while (this.isRunning) {
        // Using direct API call here because the client library doesn't allow
        // for asynchronous callbacks between pages.
        const response = await this.algoliaStore.client.customRequest<any>({
          method: 'GET',
          path: `/1/indexes/${this.mainIndex.indexName}/browse`,
          data: {
            filters: `${this.facetFilter ? `${this.facetFilter} AND ` : ''}${
              this.facetField
            }:${facet}`,
            ...(cursor ? { cursor } : {}),
          },
          cacheable: false,
        });

        yield response.hits;

        if (!response.cursor) {
          break;
        }

        cursor = response.cursor;
      }
    }
  }

  async flush(): Promise<void> {}

  async isFinished(): Promise<boolean> {
    return (
      !this.recordQueue.size &&
      !this.recordQueue.pending &&
      !this.taskQueue.size &&
      !this.taskQueue.pending
    );
  }

  async queueTask(task: TTask): Promise<void> {
    while (this.taskQueue.size > this.taskQueueConcurrency) {
      await setTimeout(ms('1 second'));
    }

    this.taskQueue.add(() => this.taskExecutor(task));
  }

  run(): void {
    this.isRunning = true;

    this.runInternal().catch((e) => {
      sentry.report(e);
    });
  }

  async runInternal(): Promise<void> {
    try {
      for await (const records of this.fetchRecords()) {
        if (!this.isRunning) {
          return;
        }

        if (!records.length) {
          continue;
        }

        log.info(
          chalk.dim.italic
            .white`[${this.constructor.name}] %d new, %d in record queue, %d in task queue`,
          records.length,
          this.recordQueue.size,
          this.taskQueue.size
        );

        for (const record of records) {
          this.recordQueue.add(() => this.recordExecutor(record));
        }

        while (this.recordQueue.size > this.recordsQueueConcurrency) {
          await setTimeout(ms('1 second'));
        }
      }
    } catch (err) {
      sentry.report(new Error(`Error in ${this.constructor.name}`), { err });
    }

    await this.flush();

    // Minimum wait between loops.
    await setTimeout(ms('5 seconds'));

    // Finish processing all records before the next batch starts.
    while (
      this.recordQueue.size ||
      this.recordQueue.pending ||
      this.taskQueue.size ||
      this.taskQueue.pending
    ) {
      await setTimeout(ms('1 second'));
    }

    return this.runInternal();
  }

  async stop(force: boolean = false): Promise<void> {
    this.isRunning = false;

    if (force) {
      this.recordQueue.clear();
      this.taskQueue.clear();
    }

    if (this.recordQueue.size || this.recordQueue.pending) {
      await this.recordQueue.onIdle();
    }

    if (this.recordQueue.size || this.taskQueue.pending) {
      await this.taskQueue.onIdle();
    }
  }

  abstract recordExecutor(record: TMainRecord): Promise<void>;

  abstract taskExecutor(task: TTask): Promise<void>;
}

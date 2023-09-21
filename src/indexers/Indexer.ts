import type { SearchIndex } from 'algoliasearch';
import type { QueueObject } from 'async';
import { queue } from 'async';
import chalk from 'chalk';
import type { DebouncedFunc } from 'lodash';
import _ from 'lodash';
import ms from 'ms';

import type { AlgoliaStore } from '../algolia';
import { log } from '../utils/log';
import * as sentry from '../utils/sentry';
import { wait } from '../utils/wait';

export abstract class Indexer<TMainRecord, TTask = TMainRecord> {
  protected mainIndex: SearchIndex;
  protected algoliaStore: AlgoliaStore;

  private recordQueue: QueueObject<TMainRecord>;
  private recordsQueueConcurrency: number = 60;

  private taskQueue: QueueObject<TTask>;
  private taskQueueConcurrency: number = 30;

  private isRunning: boolean = false;
  private readonly throttledFetchFacets: DebouncedFunc<() => Promise<string[]>>;

  protected abstract readonly facetField: string;

  get queued(): number {
    return this.taskQueue.length();
  }

  get running(): number {
    return this.taskQueue.running();
  }

  protected constructor(algoliaStore: AlgoliaStore, mainIndex: SearchIndex) {
    this.mainIndex = mainIndex;
    this.algoliaStore = algoliaStore;

    this.throttledFetchFacets = _.throttle(
      this.fetchFacets.bind(this),
      ms('1 minute')
    );

    this.recordQueue = queue<TMainRecord>(
      this.recordExecutor.bind(this),
      this.recordsQueueConcurrency
    );

    this.taskQueue = queue<TTask>(
      this.taskExecutor.bind(this),
      this.taskQueueConcurrency
    );
  }

  async *fetchRecords(): AsyncGenerator<TMainRecord[]> {
    const facets = await this.throttledFetchFacets();

    if (!facets || !facets.length) {
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
            facetFilters: `${this.facetField}:${facet}`,
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

  async isFinished(): Promise<boolean> {
    return this.recordQueue.idle() && this.taskQueue.idle();
  }

  async queueTask(task: TTask): Promise<void> {
    while (this.taskQueue.length() > this.taskQueueConcurrency) {
      await wait(ms('1 second'));
    }

    this.taskQueue.push(task);
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

        log.info(
          chalk.dim.italic
            .white`[${this.constructor.name}] %d new, %d in record queue, %d in task queue`,
          records.length,
          this.recordQueue.length(),
          this.taskQueue.length()
        );

        if (!records.length) {
          continue;
        }

        this.recordQueue.push(records);

        while (this.recordQueue.length() > this.recordsQueueConcurrency) {
          await wait(ms('1 second'));
        }
      }
    } catch (err) {
      sentry.report(new Error(`Error in ${this.constructor.name}`), { err });
    }

    // Minimum wait between loops.
    await wait(ms('5 seconds'));

    // Finish processing all records before the next batch starts.
    while (!this.recordQueue.idle() || !this.taskQueue.idle()) {
      await wait(ms('1 second'));
    }

    return this.runInternal();
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (!this.recordQueue.idle()) {
      await this.recordQueue.empty();
    }

    if (!this.taskQueue.idle()) {
      await this.taskQueue.empty();
    }
  }

  abstract fetchFacets(): Promise<string[]>;

  abstract recordExecutor(record: TMainRecord): Promise<void>;

  abstract taskExecutor(task: TTask): Promise<void>;
}

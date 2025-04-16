import { EventEmitter } from 'events';
import { setTimeout } from 'node:timers/promises';

import ms from 'ms';
import type { DatabaseChangesResponse } from 'nano';

import { config } from '../config';
import { request } from '../utils/request';
import * as sentry from '../utils/sentry';
import { backoff } from '../utils/wait';

type ChangesReaderOptions = {
  since: string;
};

export class ChangesReader extends EventEmitter {
  protected running: boolean = false;
  protected paused: boolean = false;
  protected since: string;

  constructor({ since }: ChangesReaderOptions) {
    super();

    this.since = since;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  run(): void {
    this.running = true;

    this.runInternal().catch((e) => {
      sentry.report(e);
    });
  }

  async runInternal(): Promise<void> {
    let retry = 0;

    while (this.running) {
      try {
        const { body } = await request<DatabaseChangesResponse>(
          `${config.npmRegistryEndpoint}/_changes`,
          {
            timeout: ms('60 seconds'), // Hard timeout after which the client aborts.
            headers: {
              'npm-replication-opt-in': 'true', // See https://github.com/orgs/community/discussions/152515
            },
            searchParams: {
              since: this.since,
              limit: 10,
            },
            responseType: 'json',
          }
        );

        retry = 0;

        if (body.last_seq) {
          this.since = body.last_seq;
        }

        if (body.results) {
          for (const result of body.results) {
            this.emit('change', result);
          }

          this.emit('batch', body.results);
        }

        // If there are no results, retry in 30 seconds.
        if (!body.results?.length) {
          await setTimeout(ms('30 seconds'));
        }
      } catch (e) {
        this.emit('error', e);
        await backoff(++retry, config.retryBackoffPow, config.retryBackoffMax);
      }

      while (this.running && this.paused) {
        await setTimeout(100);
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}

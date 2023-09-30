import { EventEmitter } from 'events';

import ms from 'ms';
import type { DatabaseChangesResponse } from 'nano';

import { config } from '../config';
import { request } from '../utils/request';
import * as sentry from '../utils/sentry';
import { backoff, wait } from '../utils/wait';

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
            method: 'POST',
            timeout: ms('60 seconds'), // Hard timeout after which the client aborts.
            searchParams: {
              feed: 'longpoll',
              timeout: ms('30 seconds'), // Soft timeout after which CouchDB should end the response.
              include_docs: false,
              since: this.since,
              limit: 10,
            },
            responseType: 'json',
            json: {},
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
      } catch (e) {
        this.emit('error', e);
        await backoff(++retry, config.retryBackoffPow, config.retryBackoffMax);
      }

      while (this.running && this.paused) {
        await wait(100);
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}

import * as Sentry from '@sentry/node';

import { version } from '../../package.json';

import { log } from './log';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: version,
  environment: 'prod',
  serverName: 'npm-search',
  maxBreadcrumbs: 20,
  ignoreErrors: [
    /error happened in your connection/,
    /503 Service Unavailable/,
    /<!DOCTYPE html>/,
  ],
});

export function report(err: any, extra = {}): void {
  if (!process.env.SENTRY_DSN) {
    log.error(err, extra);
    return;
  }

  log.error(err.message);
  Sentry.withScope((scope) => {
    scope.setExtras(extra);
    Sentry.captureException(err);
  });
}

export async function drain(): Promise<boolean> {
  const client = Sentry.getCurrentHub().getClient();
  if (client) {
    return await client.close(2000);
  }
  return true;
}

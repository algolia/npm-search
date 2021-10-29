import * as Sentry from '@sentry/node';

import { log } from './log';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: `1.0.0`,
  environment: 'prod',
  serverName: 'npm-search',
  ignoreErrors: [
    /error happened in your connection/,
    /503 Service Unavailable/,
    /<!DOCTYPE html>/,
  ],
});

export function report(err, extra = {}): void {
  log.error(err.message);
  if (!process.env.SENTRY_DSN) {
    log.error(err);
    return;
  }

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

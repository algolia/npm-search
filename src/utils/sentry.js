import Sentry from '@sentry/node';

import { log } from './log';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: `1.0.0`,
  environment: 'prod',
  serverName: 'npm-search',
});

export function report(err, extra = {}) {
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

export function drain() {
  const client = Sentry.getCurrentHub().getClient();
  if (client) {
    return client.close(2000);
  }
  return Promise.resolve();
}

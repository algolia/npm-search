import Sentry from '@sentry/node';

import log from '../log.js';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: `1.0.0`,
  environment: 'prod',
  serverName: 'npm-search',
});

function report(err, extra = {}) {
  log.error(err.message);
  if (!process.env.SENTRY_DSN) {
    log.error(err);
    return;
  }

  Sentry.withScope(scope => {
    scope.setExtras(extra);
    Sentry.captureException(err);
  });
}

export { report };

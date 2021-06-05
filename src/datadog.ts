import StatsD from 'hot-shots';

import log from './log.js';

const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

export const datadog = new StatsD({
  host: process.env.DOGSTATSD_HOST || 'localhost',
  port: 8125,
  prefix: 'alg.npmsearch.',
  globalTags: {
    env,
  },
  errorHandler(error): void {
    log.error('[DATADOG ERROR]', error);
  },
});

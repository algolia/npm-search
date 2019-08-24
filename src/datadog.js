import StatsD from 'hot-shots';
import log from './log.js';

const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const client = new StatsD({
  host: process.env.DOGSTATSD_HOST,
  port: 8125,
  prefix: 'alg.npmsearch.',
  mock: !process.env.DOGSTATSD_HOST,
  globalTags: {
    env,
  },
  errorHandler(error) {
    log.error('[DATADOG ERROR]', error);
  },
});

export default client;

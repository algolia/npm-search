/* eslint-disable import/no-commonjs */
const serviceVersion = require('./package.json').version;

module.exports = {
  active: true,
  serviceName: 'jsdelivr-npm-search',
  serviceVersion,
  logLevel: 'fatal',
  centralConfig: false,
  captureExceptions: false,
  captureErrorLogStackTraces: 'always',
  ignoreUrls: [
    '/favicon.ico',
    '/heartbeat',
    '/amp_preconnect_polyfill_404_or_other_error_expected._Do_not_worry_about_it',
  ],
  errorOnAbortedRequests: false,
  transactionSampleRate: 1,
};

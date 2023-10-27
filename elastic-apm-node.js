/* eslint-disable import/no-commonjs */
import fs from 'node:fs/promises';

const packageJson = JSON.parse(await fs.readFile('package.json'));

module.exports = {
  active: true,
  serviceName: 'jsdelivr-npm-search',
  serviceVersion: packageJson.version,
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

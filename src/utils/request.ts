import http from 'http';
import https from 'https';

import type { OptionsOfJSONResponseBody } from 'got';
import got from 'got';

import { config } from '../config';

// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-commonjs
const { version } = require('../../package.json');

export const USER_AGENT = `Algolia npm-search/${version} (https://github.com/algolia/npm-search)`;

const options: http.AgentOptions = {
  keepAlive: true,
  timeout: 60000,
  maxFreeSockets: 2000,
  scheduling: 'fifo',
};

// The agents will pool TCP connections
export const httpAgent = new http.Agent(options);
export const httpsAgent = new https.Agent(options);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function request<TRes>(
  url: string,
  opts: OptionsOfJSONResponseBody
) {
  return await got<TRes>(url, {
    timeout: config.defaultRequestTimeout,
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'user-agent': USER_AGENT,
    },
    dnsCache: true,
    dnsLookupIpVersion: 'ipv4',
    agent: {
      http: httpAgent,
      https: httpsAgent,
    },
  });
}

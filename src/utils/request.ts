import http from 'http';
import https from 'https';

import type { OptionsOfJSONResponseBody } from 'got';
import got from 'got';

const options = {
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
    ...opts,
    agent: {
      http: httpAgent,
      https: httpsAgent,
    },
  });
}

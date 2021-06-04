import http from 'http';
import https from 'https';

import got from 'got';

const options = {
  keepAlive: true,
  timeout: 60_000,
  maxFreeSockets: 2000,
  scheduling: 'fifo',
};

// The agents will pool TCP connections
export const httpAgent = new http.Agent(options);
export const httpsAgent = new https.Agent(options);

export async function request(url, opts) {
  return await got(url, {
    ...opts,
    agent: {
      http: httpAgent,
      https: httpsAgent,
    },
  });
}

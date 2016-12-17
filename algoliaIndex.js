import algoliasearch from 'algoliasearch';
import errors from './errors.js';
import c from './config.js';

if (!c.apiKey) throw new Error(errors.noApiKey);

const client = algoliasearch(c.appId, c.apiKey, {
  timeouts: {
    connect: c.connectTimeout,
    read: c.readTimeout,
    write: c.writeTimeout,
  },
});
export default client.initIndex(c.indexName);

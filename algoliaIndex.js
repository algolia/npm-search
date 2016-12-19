import algoliasearch from 'algoliasearch';
import c from './config.js';

if (!c.apiKey) throw new Error('npm-search: Please provide the `apiKey` env variable and restart');

const client = algoliasearch(c.appId, c.apiKey);
const index = client.initIndex(c.indexName);

export default index;

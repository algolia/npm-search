import algoliasearch from 'algoliasearch';
import c from './config.js';

export default indexName => {
  if (!c.apiKey)
    throw new Error(
      'npm-search: Please provide the `apiKey` env variable and restart'
    );

  const client = algoliasearch(c.appId, c.apiKey);
  return {
    index: client.initIndex(indexName),
    client,
  };
};

import algoliasearch from 'algoliasearch';
import config from './config.js';

export default indexName => {
  if (!config.apiKey)
    throw new Error(
      'npm-search: Please provide the `apiKey` env variable and restart'
    );

  const client = algoliasearch(config.appId, config.apiKey);
  return {
    index: client.initIndex(indexName),
    client,
  };
};

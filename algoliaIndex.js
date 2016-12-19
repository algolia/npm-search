import algoliasearch from 'algoliasearch';
import c from './config.js';

if (!c.apiKey) throw new Error('npm-search: Please provide the `apiKey` env variable and restart');

const client = algoliasearch(c.appId, c.apiKey);
const index = client.initIndex(c.indexName);

index.setSettings({
  searchableAttributes: ['unordered(name)', 'unordered(description)',
    'unordered(keywords)', 'author.name', 'owners.name'],
  customRanking: ['desc(downloadsLast30Days)'],
  exactOnSingleWordQuery: 'word',
  ranking: ['asc(popular)', 'typo', 'geo', 'words', 'filters', 'proximity', 'attribute', 'exact', 'custom'],
});

export default index;

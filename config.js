const defaultConfig = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com/registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  popularDownloadsRatio: 0.2,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  concurrency: 500,
  seq: null,
  indexSettings: {
    searchableAttributes: [
      'unordered(name)',
      'unordered(description)',
      'unordered(keywords)',
      'author.name',
      'owners.name',
    ],
    customRanking: ['desc(downloadsLast30Days)'],
    disablePrefixOnAttributes: ['description', 'keywords', 'author.name', 'owners.name'],
    disableExactOnAttributes: ['description', 'keywords', 'author.name', 'owners.name'],
    exactOnSingleWordQuery: 'attribute',
    ranking: [
      'desc(popular)',
      'typo', 'geo', 'words', 'filters', 'proximity', 'attribute', 'exact', 'custom',
    ],
  },
};

export default Object
  .entries(defaultConfig)
  .reduce((res, [key, defaultValue]) => ({
    ...res,
    [key]: key in process.env ?
      JSON.parse(
        typeof defaultValue === 'string' ?
          `"${process.env[key]}"`
          : process.env[key]
      )
      : defaultValue,
  }), {});

const defaultConfig = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com/registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  popularDownloadsRatio: 0.02,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  replicateConcurrency: 10,
  bootstrapConcurrency: 100,
  seq: null,
  indexSettings: {
    searchableAttributes: [
      'unordered(name)',
      'unordered(description)',
      'unordered(keywords)',
      'author.name',
      'owners.name',
    ],
    attributesForFaceting: ['onlyFilter(name)'], // optionalFacetFilters to boost the name
    customRanking: ['desc(downloadsLast30Days)'],
    disablePrefixOnAttributes: ['description', 'keywords', 'author.name', 'owners.name'],
    disableExactOnAttributes: ['description', 'keywords', 'author.name', 'owners.name'],
    disableTypoToleranceOnAttributes: ['keywords'],
    exactOnSingleWordQuery: 'attribute',
    ranking: [
      'filters',
      'typo',
      'words',
      'proximity',
      'attribute',
      'desc(popular)',
      'exact',
      'custom',
    ],
    optionalWords: ['js', 'javascript'],
    separatorsToIndex: '_',
    synonyms: [
      ['_', 'underscore'],
    ],
    replaceSynonymsInHighlight: false,
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

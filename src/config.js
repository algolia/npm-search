import { config } from 'dotenv';
config();

const defaultConfig = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com/registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  maxObjSize: 450000,
  popularDownloadsRatio: 0.005,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  bootstrapIndexName: 'npm-search-bootstrap',
  replicateConcurrency: 10,
  bootstrapConcurrency: 100,
  timeToRedoBootstrap: 7 * 24 * 3600 * 1000 /* one week */,
  seq: null,
  indexSettings: {
    searchableAttributes: [
      'unordered(popularName)',
      'unordered(name)',
      'unordered(concatenatedName)',
      'unordered(description)',
      'unordered(keywords)',
      'owner.name',
      'owners.name',
    ],
    attributesForFaceting: [
      'filterOnly(concatenatedName)' /* optionalFacetFilters to boost the name */,
      'searchable(keywords)',
      'searchable(owner.name)',
      'deprecated',
    ],
    customRanking: ['desc(downloadsLast30Days)'],
    disablePrefixOnAttributes: ['keywords', 'owner.name', 'owners.name'],
    disableExactOnAttributes: [
      'description',
      'keywords',
      'owner.name',
      'owners.name',
    ],
    disableTypoToleranceOnAttributes: ['keywords'],
    exactOnSingleWordQuery: 'attribute',
    ranking: [
      'filters',
      'typo',
      'words',
      'proximity',
      'attribute',
      'asc(deprecated)',
      'asc(badPackage)',
      'desc(popular)',
      'exact',
      'custom',
    ],
    optionalWords: ['js', 'javascript'],
    separatorsToIndex: '_',
    replaceSynonymsInHighlight: false,
  },
  indexSynonyms: [
    {
      type: 'synonym',
      synonyms: ['_', 'underscore'],
      objectID: 'underscore',
    },
  ],
  indexRules: [
    {
      objectID: 'promote-exact',
      description: 'promote exact matches',
      condition: {
        pattern: '{facet:concatenatedName}',
        anchoring: 'is',
      },
      consequence: {
        params: {
          automaticOptionalFacetFilters: ['concatenatedName'],
        },
      },
    },
  ],
};

export default Object.entries(defaultConfig).reduce(
  (res, [key, defaultValue]) => ({
    ...res,
    [key]:
      key in process.env
        ? JSON.parse(
            typeof defaultValue === 'string'
              ? `"${process.env[key]}"`
              : process.env[key]
          )
        : defaultValue,
  }),
  {}
);

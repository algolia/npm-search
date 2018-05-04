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
      'unordered(_searchInternal.popularName)',
      'name, _searchInternal.concatenatedName, description, keywords',
      'owner.name',
      'owners.name',
    ],
    attributesForFaceting: [
      'filterOnly(_searchInternal.concatenatedName)' /* optionalFacetFilters to boost the name */,
      'searchable(keywords)',
      'searchable(computedKeywords)',
      'searchable(owner.name)',
      'deprecated',
    ],
    customRanking: [
      'desc(_searchInternal.downloadsMagnitude)',
      'desc(dependents)',
      'desc(downloadsLast30Days)',
    ],
    disablePrefixOnAttributes: ['owner.name', 'owners.name'],
    disableExactOnAttributes: ['owner.name', 'owners.name'],
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
      objectID: 'promote-exact-old',
      description: 'promote exact matches (old, delete me in a next PR)',
      condition: {
        pattern: '{facet:_searchInternal.concatenatedName}',
        anchoring: 'is',
      },
      consequence: {
        params: {
          automaticOptionalFacetFilters: ['_searchInternal.concatenatedName'],
        },
      },
    },
    // not yet enabled, but to be done in a replica after this is merged and
    // in production
    // {
    //   objectID: 'promote-exact',
    //   description: 'promote exact matches',
    //   condition: {
    //     pattern: '{facet:_searchInternal.alternativeNames}',
    //     anchoring: 'is',
    //   },
    //   consequence: {
    //     params: {
    //       automaticOptionalFacetFilters: ['_searchInternal.alternativeNames'],
    //     },
    //   },
    // },
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

import { config } from 'dotenv';
config();
import ms from 'ms';

const defaultConfig = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com/registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  npmRootEndpoint: 'https://api.npmjs.org/',
  jsDelivrHitsEndpoint: 'https://data.jsdelivr.com/v1/stats/packages/month/all',
  unpkgRoot: 'https://unpkg.com/',
  maxObjSize: 450000,
  popularDownloadsRatio: 0.005,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  bootstrapIndexName: 'npm-search-bootstrap',
  replicateConcurrency: 10,
  bootstrapConcurrency: 100,
  timeToRedoBootstrap: ms('1 week'),
  seq: null,
  indexSettings: {
    searchableAttributes: [
      'unordered(_searchInternal.popularName)',
      'name, description, keywords',
      '_searchInternal.alternativeNames',
      'owner.name',
      'owners.name',
    ],
    attributesForFaceting: [
      'filterOnly(_searchInternal.alternativeNames)' /* optionalFacetFilters to boost the name */,
      'filterOnly(bin)',
      'searchable(keywords)',
      'searchable(computedKeywords)',
      'searchable(owner.name)',
      'deprecated',
    ],
    customRanking: [
      'desc(_searchInternal.downloadsMagnitude)',
      'desc(_searchInternal.jsDelivrPopularity)',
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
    {
      type: 'synonym',
      synonyms: ['a11y', 'accessibility', 'accessible'],
      objectID: 'a11y',
    },
    {
      type: 'synonym',
      synonyms: [
        'i18n',
        'internationalisation',
        'internationalization',
        'translation',
        'translate',
      ],
      objectID: 'i18n',
    },
    {
      type: 'synonym',
      synonyms: ['k8s', 'kubernetes'],
      objectID: 'k8s',
    },
  ],
  indexRules: [
    {
      objectID: 'promote-exact',
      description: 'promote exact matches',
      condition: {
        pattern: '{facet:_searchInternal.alternativeNames}',
        anchoring: 'is',
      },
      consequence: {
        params: {
          automaticOptionalFacetFilters: ['_searchInternal.alternativeNames'],
        },
      },
    },
    {
      condition: {
        pattern: 'author\\: {facet:owner.name}',
        anchoring: 'contains',
      },
      consequence: {
        params: {
          automaticFacetFilters: ['owner.name'],
          query: {
            remove: ['author\\:', '{facet:owner.name}'],
          },
        },
      },
      description: 'filter on author: {owner.name}',
      objectID: 'author-filter',
    },
    {
      condition: {
        pattern: 'owner\\: {facet:owner.name}',
        anchoring: 'contains',
      },
      consequence: {
        params: {
          automaticFacetFilters: ['owner.name'],
          query: {
            remove: ['owner\\:', '{facet:owner.name}'],
          },
        },
      },
      description: 'filter on owner: {owner.name}',
      objectID: 'owner-filter',
    },
    {
      condition: {
        pattern: 'keyword\\: {facet:keywords}',
        anchoring: 'contains',
      },
      consequence: {
        params: {
          automaticFacetFilters: ['keywords'],
          query: {
            remove: ['keyword\\:', '{facet:keywords}'],
          },
        },
      },
      description: 'filter on keyword: {keywords}',
      objectID: 'keyword-filter',
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

import type { Settings, Synonym, Rule } from '@algolia/client-search';
import ms from 'ms';

const indexSettings: Settings = {
  searchableAttributes: [
    'unordered(_popularName)',
    'name, description, keywords',
    '_searchInternal.popularAlternativeNames',
    'owner.name',
    'owners.name',
  ],
  attributesForFaceting: [
    'filterOnly(_searchInternal.popularAlternativeNames)' /* optionalFacetFilters to boost the name */,
    'filterOnly(bin)',
    'searchable(keywords)',
    'searchable(computedKeywords)',
    'searchable(owner.name)',
    '_oneTimeDataToUpdateAt',
    '_periodicDataUpdatedAt',
    'deprecated',
    'isDeprecated',
    'isSecurityHeld',
    'types.ts',
    'moduleTypes',
    'styleTypes',
    'popular',
  ],
  customRanking: [
    'desc(_downloadsMagnitude)',
    'desc(_jsDelivrPopularity)',
    'desc(dependents)',
    'desc(downloadsLast30Days)',
  ],
  disablePrefixOnAttributes: ['owner.name', 'owners.name'],
  disableExactOnAttributes: ['owner.name', 'owners.name'],
  exactOnSingleWordQuery: 'word',
  ranking: [
    'filters',
    'typo',
    'words',
    'attribute',
    'proximity',
    'asc(isSecurityHeld)',
    'asc(deprecated)',
    'asc(isDeprecated)',
    'asc(badPackage)',
    'desc(popular)',
    'exact',
    'custom',
  ],
  minProximity: 5,
  optionalWords: ['js', 'javascript', 'css'],
  separatorsToIndex: '_',
  replaceSynonymsInHighlight: false,
  maxValuesPerFacet: 1000,
  unretrievableAttributes: ['_oneTimeDataToUpdateAt', '_periodicDataUpdatedAt'],
};

const indexSynonyms: Synonym[] = [
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
];

const indexRules: Rule[] = [
  {
    objectID: 'promote-exact',
    description: 'promote exact matches',
    condition: {
      pattern: '{facet:_searchInternal.popularAlternativeNames}',
      anchoring: 'is',
    },
    consequence: {
      params: {
        automaticOptionalFacetFilters: [
          {
            facet: '_searchInternal.popularAlternativeNames',
          },
        ],
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
];

export const config = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com',
  npmRegistryDBName: 'registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  npmRootEndpoint: 'https://registry.npmjs.org',
  jsDelivrHitsEndpoint:
    'https://data.jsdelivr.com/v1/stats/packages/all?period=month&type=npm',
  jsDelivrPackageEndpoint: 'https://data.jsdelivr.com/v1/package/npm',
  typescriptTypesIndex: 'https://cdn.jsdelivr.net/npm/all-the-package-types',
  maxObjSize: 450000,
  popularDownloadsRatio: 0.005,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  bootstrapIndexName: 'npm-search-bootstrap',
  bootstrapConcurrency: 25,
  timeToRedoBootstrap: ms('30 days'),
  seq: undefined,
  indexSettings,
  indexSynonyms,
  indexRules,
  prefetchWaitBetweenPage: 5000,
  retryMax: 4,
  retrySkipped: ms('1 minute'),
  retryBackoffPow: 3,
  retryBackoffMax: ms('1 minute'),
  refreshPeriod: ms('2 minutes'),
  alternativeNamesNpmDownloadsThreshold: 5000,
  alternativeNamesJsDelivrHitsThreshold: 10000,

  // http
  defaultRequestTimeout: ms('30 seconds'),

  // Watch
  watchMaxPrefetch: 10,
  watchMinUnpause: 5,
};

export type Config = typeof config;

Object.entries(process.env).forEach(([key, value]) => {
  if (key in config) {
    config[key] =
      typeof config[key] === 'number' ? parseInt(value!, 10) : value;
  }
});

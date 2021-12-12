import type { Settings, Synonym, Rule } from '@algolia/client-search';
import ms from 'ms';

const indexSettings: Settings = {
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
    '_searchInternal.expiresAt',
    'deprecated',
    'isDeprecated',
    'types.ts',
    'moduleTypes',
    'styleTypes',
    'popular',
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
    'asc(isDeprecated)',
    'asc(badPackage)',
    'desc(popular)',
    'exact',
    'custom',
  ],
  optionalWords: ['js', 'javascript'],
  separatorsToIndex: '_',
  replaceSynonymsInHighlight: false,
  maxValuesPerFacet: 1000,
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
      pattern: '{facet:_searchInternal.alternativeNames}',
      anchoring: 'is',
    },
    consequence: {
      params: {
        automaticOptionalFacetFilters: [
          {
            facet: '_searchInternal.alternativeNames',
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
    'https://data.jsdelivr.com/v1/stats/packages/npm/month/all',
  jsDelivrPackageEndpoint: 'https://data.jsdelivr.com/v1/package/npm',
  typescriptTypesIndex:
    'https://typespublisher.blob.core.windows.net/typespublisher/data/search-index-min.json',
  maxObjSize: 450000,
  popularDownloadsRatio: 0.005,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  bootstrapIndexName: 'npm-search-bootstrap',
  bootstrapConcurrency: 25,
  timeToRedoBootstrap: ms('1 month'),
  seq: undefined,
  indexSettings,
  indexSynonyms,
  indexRules,
  expiresAt: ms('30 days'),
  popularExpiresAt: ms('7 days'),
  cacheTotalDownloads: ms('1 minute'),
  prefetchWaitBetweenPage: 5000,
  prefetchMaxIdle: 100,
  retryMax: 2,
  retrySkipped: ms('1 minute'),
  retryBackoffPow: 3,
  refreshPeriod: ms('2 minutes'),
};

export type Config = typeof config;

Object.entries(process.env).forEach(([key, value]) => {
  if (typeof config[key] !== 'undefined') {
    config[key] =
      typeof config[key] === 'number' ? parseInt(value!, 10) : value;
  }
});

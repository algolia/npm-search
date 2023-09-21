import { log } from '../utils/log';

import { Indexer } from './Indexer';

export abstract class MainIndexer<TMainRecord> extends Indexer<TMainRecord> {
  async fetchFacets(): Promise<string[]> {
    const result = await this.mainIndex.search('', {
      facets: [this.facetField],
      hitsPerPage: 0,
      maxValuesPerFacet: 1000,
      sortFacetValuesBy: 'alpha',
    });

    if (!result.facets) {
      log.error('Wrong results from Algolia');
      return [];
    }

    return Object.keys(result.facets[this.facetField] || {}).sort();
  }

  async fetchQueueLength(): Promise<number> {
    const { nbHits } = await this.mainIndex.search('');
    return nbHits;
  }
}

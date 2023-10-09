import { Indexer } from './Indexer';

export abstract class MainIndexer<TMainRecord> extends Indexer<TMainRecord> {
  async fetchQueueLength(): Promise<number> {
    const { nbHits } = await this.mainIndex.search('', {
      filters: this.facetFilter,
    });

    return nbHits;
  }
}

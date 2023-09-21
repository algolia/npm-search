import type { SearchIndex } from 'algoliasearch';

import type { AlgoliaStore } from '../algolia';

import { Indexer } from './Indexer';

export abstract class BackgroundIndexer<
  TMainRecord,
  TTask = TMainRecord
> extends Indexer<TMainRecord, TTask> {
  protected dataIndex: SearchIndex;

  constructor(
    algoliaStore: AlgoliaStore,
    mainIndex: SearchIndex,
    dataIndex: SearchIndex
  ) {
    super(algoliaStore, mainIndex);

    this.dataIndex = dataIndex;
  }
}

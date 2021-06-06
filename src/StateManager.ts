import type { SearchIndex } from 'algoliasearch';

import { config } from './config';
import { datadog } from './utils/datadog';

type State = {
  seq: number | null;
  bootstrapDone: boolean;
  bootstrapLastId?: number;
};
const defaultState: State = {
  seq: config.seq,
  bootstrapDone: false,
  bootstrapLastId: undefined,
};

export class StateManager {
  algoliaIndex;
  currentState: State = { ...defaultState };
  refreshed: boolean = false;

  constructor(algoliaIndex: SearchIndex) {
    this.algoliaIndex = algoliaIndex;
  }

  async check(): Promise<State> {
    if (config.seq !== null) {
      return this.reset();
    }

    const state = await this.get();

    if (state === undefined) {
      return this.reset();
    }

    return state;
  }

  async get(): Promise<State> {
    if (this.currentState && this.refreshed) {
      return this.currentState;
    }

    const start = Date.now();
    const { userData } = await this.algoliaIndex.getSettings();
    datadog.timing('stateManager.get', Date.now() - start);

    this.refreshed = true;
    return userData;
  }

  async set(state: State): Promise<State> {
    this.currentState = state;

    const start = Date.now();
    await this.algoliaIndex.setSettings({
      userData: state,
    });
    datadog.timing('stateManager.set', Date.now() - start);

    return state;
  }

  async reset(): Promise<State> {
    return await this.set(defaultState);
  }

  async save(partial: Partial<State>): Promise<State> {
    const current = await this.get();

    return await this.set({
      ...current,
      ...partial,
    });
  }
}

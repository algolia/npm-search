import { config } from './config.ts';
import datadog from './datadog.js';

const defaultState = {
  seq: config.seq,
  bootstrapDone: false,
  bootstrapLastId: undefined,
};

export default (algoliaIndex) => {
  let currentState;

  return {
    async check() {
      if (config.seq !== null) return this.reset();
      const state = await this.get();

      if (state === undefined) {
        return this.reset();
      }

      return state;
    },

    async get() {
      if (currentState) {
        return currentState;
      }

      const start = Date.now();
      const { userData } = await algoliaIndex.getSettings();
      datadog.timing('stateManager.get', Date.now() - start);

      return userData;
    },

    async set(state) {
      currentState = state;

      const start = Date.now();
      await algoliaIndex.setSettings({
        userData: state,
      });
      datadog.timing('stateManager.set', Date.now() - start);

      return state;
    },

    async reset() {
      return await this.set(defaultState);
    },

    async save(partial) {
      const current = (await this.get()) || defaultState;

      return await this.set({
        ...current,
        ...partial,
      });
    },
  };
};

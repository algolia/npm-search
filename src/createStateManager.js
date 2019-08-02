import c from './config.js';

const defaultState = {
  seq: c.seq,
  bootstrapDone: false,
  bootstrapLastId: undefined,
};

let currentState;

export default algoliaIndex => ({
  async check() {
    if (c.seq !== null) return this.reset();
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

    const { userData } = await algoliaIndex.getSettings();
    return userData;
  },

  async set(state) {
    currentState = state;

    await algoliaIndex.setSettings({
      userData: state,
    });
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
});

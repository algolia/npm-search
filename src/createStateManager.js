import c from './config.js';

const defaultState = {
  seq: c.seq,
  bootstrapDone: false,
  bootstrapLastId: 'zzz',
};

let currentState;

export default algoliaIndex => ({
  check() {
    if (c.seq !== null) return this.reset();
    return this.get().then(
      state => (state === undefined ? this.reset() : state)
    );
  },
  get() {
    return currentState
      ? Promise.resolve(currentState)
      : algoliaIndex.getSettings().then(({ userData }) => userData);
  },
  set(state) {
    currentState = state;

    return algoliaIndex
      .setSettings({
        userData: state,
      })
      .then(() => state);
  },
  reset() {
    return this.set(defaultState);
  },
  save(partial) {
    return this.get().then((current = defaultState) =>
      this.set({
        ...current,
        ...partial,
      })
    );
  },
});

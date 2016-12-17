import algoliaIndex from './algoliaIndex.js';
import c from './config.js';

const defaultState = {
  initialReplicationInProgress: false,
  initialReplicationDone: false,
  seq: null,
};

export default {
  check() {
    if (c.reset === true) return this.reset();
    return this
      .get()
      .then(
        state => state === undefined ?
          this.reset()
          : state
      );
  },
  get() {
    return algoliaIndex.getSettings().then(({userData}) => userData);
  },
  set(state) {
    return algoliaIndex
      .setSettings({userData: state})
      .then(({taskID}) => algoliaIndex.waitTask(taskID))
      .then(this.get);
  },
  reset() {
    return this.set(defaultState);
  },
  save(partial) {
    return this
      .get()
      .then(
        (current = defaultState) => this.set({...current, ...partial})
      );
  },
};

import c from './config.js';
import redis from 'redis';
import { promisify } from 'util';

const client = redis.createClient(process.env.REDIS_URL);

const getData = promisify(client.get).bind(client);
const setData = promisify(client.set).bind(client);

client.on('error', err => {
  throw err;
});

const defaultState = {
  seq: c.seq,
  bootstrapDone: false,
  bootstrapLastId: undefined,
};

let currentState;

export default () => ({
  check() {
    if (c.seq !== null) return this.reset();
    return this.get().then(state => (state === null ? this.reset() : state));
  },
  get() {
    return currentState
      ? Promise.resolve(currentState)
      : getData('index-state').then(data => JSON.parse(data));
  },
  set(state) {
    currentState = state;

    return setData('index-state', JSON.stringify(state)).then(() => state);
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

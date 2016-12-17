import got from 'got';
import c from './config.js';

export default {
  info() {
    return got(c.registryEndpoint, {json: true})
      .then(
        ({body: {doc_count: nbPackages, update_seq: seq}}) => ({nbPackages, seq})
      );
  },
  getPackagesStream() {
    return got.stream(`${c.registryEndpoint}/-/all`);
  },
};

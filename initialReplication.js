import npm from './npm.js';
import stateManager from './stateManager.js';
import log from './log.js';
import algoliaIndex from './algoliaIndex.js';
import JSONStream from 'JSONStream';
import c from './config.js';
import {cargo} from 'async';

export default function initialReplication() {
  let todo;
  let done = 0;
  let loopStart = Date.now();

  const pkgsToSave = cargo((pkgs, cb) => {
    done += pkgs.length;
    algoliaIndex
      .saveObjects(pkgs)
      .then(() => {
        log.info(
          'Replicated %d/%d (%d%), rate: %d packages/s',
          done,
          todo,
          Math.round(done / todo * 100),
          Math.round(pkgs.length / ((Date.now() - loopStart) / 1000))
        );
        loopStart = Date.now();
      })
      .then(cb)
      .catch(cb);
  }, c.maximumConcurrency);

  return npm
    .info()
    .then(({nbPackages, seq}) => {
      log.info('There are %d packages to replicate', nbPackages);
      log.info('Changes should be watched since seq: %d', seq);
      todo = nbPackages;
      return stateManager.save({seq, initialReplicationInProgress: true});
    })
    .then(() => new Promise((resolve, reject) => {
      const res = npm.getPackagesStream();
      const json = res.pipe(JSONStream.parse('*', onlyPackages));

      json
          .on('data', onData)
          .on('error', reject);

      function onData(pkg) {
        pkgsToSave.push(pkg, err => {
          if (err) {
            reject(err);
            return;
          }

          if (done === todo) resolve();
        });
      }
    }))
    .then(() => stateManager.save({initialReplicationDone: true}));
}

function onlyPackages(pkg) {
  return typeof pkg === 'object' ? {objectID: pkg.name, ...pkg} : null;
}

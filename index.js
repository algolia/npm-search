import errors from './errors.js';
import stateManager from './stateManager.js';
import initialReplication from './initialReplication.js';
import watchRegistryUpdates from './watchRegistryUpdates.js';
import log from './log.js';

log.info('🗿 NPM => Algolia replication starts');

stateManager
  .check()
  .then(
    state => {
      if (state.initialReplicationInProgress === true) {
        throw new Error(errors.initialReplicationInProgress);
      }

      // initial replication must be done in a single run. Which means if it fails, you will have to start over
      // making it resilient is no more feasible with npm
      // the only way to do it would be to use only the couchdb changes starting at the first change of the DB
      // but that's too slow
      if (state.initialReplicationDone === true) {
        log.info('👍 Initial replication was done');
        log.info('🔭 Now watching for registry updates');
        return watchRegistryUpdates();
      } else {
        log.info('🔨 Initial replication starts');
        return initialReplication();
      }
    }
  )
  .catch(err => setTimeout(() => { throw err; }, 0));

/* eslint-disable no-console */

import { Writable } from 'node:stream';

import semanticRelease from 'semantic-release';

const stream = new Writable({
  write(_chunk, _encoding, callback) {
    setImmediate(callback);
  },
});

// Execute semantic-release with only the commit-analyzer step, to see if
// a new release is needed
const { nextRelease } = await semanticRelease(
  {
    dryRun: true,
    plugins: ['@semantic-release/commit-analyzer'],
    verifyConditions: [],
    analyzeCommits: ['@semantic-release/commit-analyzer'],
    verifyRelease: [],
    generateNotes: [],
    prepare: [],
    publish: [],
    addChannel: [],
    success: [],
    fail: [],
  },
  // Redirect output to new streams, to make the script silent
  {
    stdout: stream,
    stderr: stream,
  }
);

// Display yes if a new release should be published, or no otherwise
// The output of this script is used by the publishing workflow, to
// conditionally either cancel the run, or actually publish to Docker/GitHub.
// Make sure it only ever output either yes or no
console.info(nextRelease?.version ? 'yes' : 'no');

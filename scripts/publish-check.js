/* eslint-disable import/no-commonjs */
/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint-disable @typescript-eslint/no-var-requires */
const { Writable } = require('node:stream');

const semanticRelease = require('semantic-release');

(async () => {
  console.log('Analyzing commits since last version...');

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

  // Exit with 0 if a new version must be released, 1 if nothing to do
  if (nextRelease?.version) {
    console.log(
      `Commits analyzed warrant a release of version ${nextRelease.version}`
    );
    process.exit(0);
  }
  console.log('No new version to publish');
  process.exit(1);
})();

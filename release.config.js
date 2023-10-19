/* eslint-disable import/no-commonjs */
/* eslint-disable no-template-curly-in-string */
/**
 * We use semantic-release to automate the publishing of new versions based on
 * the commit history: whenever a commit is pushed to the master branch, it
 * checks if any commit had a BREAKING CHANGE / feat() / fix() message, and
 * publishes (or not) a new major.minor/patch version accordingly.
 *
 * See: https://github.com/semantic-release/semantic-release.
 *
 * Semantic-release executes steps in order (from verifyConditions to
 * success/fail). For each step, it execute the matching code in each plugin (if
 * such exists). If any step fails, the whole process stop.
 *
 * As we are using a mix of core and community plugins, as well as slightly
 * diverging from the default use-case, we explictly define the order of plugins
 * in each step instead of relying on the default order.
 *
 * The current configuration will:
 * - Check if a new version needs to be published (and stop if not)
 * - Update the version number in package.json accordingly
 * - Update the CHANGELOG.md with the changes
 * - Create a new commit, and tag it with the version number
 * - Publish the code source to GitHub Releases (not very useful).
 *
 * Specifically, it does not:
 * - Publish the code to npm (this is not an npm module)
 * - Publish the Docker image (yarn publish:docker takes care of that).
 **/
module.exports = {
  branches: 'master',
  plugins: [
    // Those 4 plugins are part of the core of semantic-release
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
    // Those 2 are additional plugins
    '@semantic-release/changelog',
    '@semantic-release/git',
  ],
  // Below are the various steps
  // Source: https://semantic-release.gitbook.io/semantic-release/usage/plugins
  // We explicitly define because it allows us to:
  // - remove steps that we don't need (for example verifying npm credentials as
  //   we don't publish on npm)
  // - put steps in order (for example updating the changelog file before
  //   committing it)
  verifyConditions: ['@semantic-release/github', '@semantic-release/git'],
  analyzeCommits: ['@semantic-release/commit-analyzer'],
  verifyRelease: [],
  generateNotes: ['@semantic-release/release-notes-generator'],
  prepare: [
    '@semantic-release/changelog',
    '@semantic-release/npm',
    {
      path: '@semantic-release/git',
      assets: ['package.json', 'CHANGELOG.md'],
      message:
        'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    },
  ],
  publish: ['@semantic-release/github'],
  addChannel: [],
  success: [],
  fail: [],
};

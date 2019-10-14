// this test exists to prevent renovate updating further than Node v12.10
// see https://github.com/algolia/npm-search/pull/448
// and https://github.com/eslint/eslint/issues/12319

test('node version is 12.10.0', () => {
  expect(process.version).toBe('v12.10.0');
});

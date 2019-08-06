module.exports = {
  extends: ['algolia', 'algolia/jest'],
  rules: {
    'valid-jsdoc': 'off',
    'import/extensions': ['error', 'always', { ignorePackages: true }],
  },
};

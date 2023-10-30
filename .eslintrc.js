/* eslint-disable import/no-commonjs */

/**
 * @type {import('eslint').Linter.Config}
 */
const config = {
  extends: ['algolia', 'algolia/jest'],
  rules: {
    'no-continue': 'off',
    'valid-jsdoc': 'off',
    'require-await': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['algolia/typescript'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
      },
      rules: {
        'consistent-return': 'off',
        'no-dupe-class-members': 'off',
        'import/extensions': [
          'error',
          {
            ignorePackages: true,
            pattern: {
              js: 'always',
              ts: 'never',
            },
          },
        ],
      },
    },
  ],
};

module.exports = config;

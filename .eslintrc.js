/* eslint-disable import/no-commonjs */
const defaultRules = {
  'no-continue': 'off',
  'valid-jsdoc': 'off',
  'require-await': 'off',
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
};
module.exports = {
  overrides: [
    {
      files: ['**/*.js'],
      extends: ['algolia', 'algolia/jest'],
      rules: defaultRules,
    },
    {
      files: ['**/*.ts'],
      extends: ['algolia', 'algolia/jest', 'algolia/typescript'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
      },
      rules: {
        ...defaultRules,
        'consistent-return': 'off',
        'no-dupe-class-members': 'off',
        '@typescript-eslint/sort-type-union-intersection-members': 'off',
      },
    },
  ],
};

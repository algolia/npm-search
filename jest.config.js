// eslint-disable-next-line import/no-commonjs
module.exports = {
  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
  },
  testMatch: ['<rootDir>/src/**/*.test.[jt]s'],
  // By default, ignore the slow and flaky tests testing external APIs. Those
  // will be run specifically with `yarn run test:sanity-check`
  testPathIgnorePatterns: ['sanity-check'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: `tsconfig.json`,
    },
  },

  testEnvironment: 'node',
  modulePaths: ['src'],
};

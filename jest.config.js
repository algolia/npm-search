// eslint-disable-next-line import/no-commonjs
module.exports = {
  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
  },
  testMatch: ['<rootDir>/src/**/*.test.[jt]s'],
  // By default, ignore the slow and flaky tests testing external APIs. Those
  // will be run specifically with `yarn run test:api-control`
  testPathIgnorePatterns: ['api-control'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: `tsconfig.json`,
    },
  },

  testEnvironment: 'node',
  modulePaths: ['src'],
};

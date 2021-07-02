// eslint-disable-next-line import/no-commonjs
module.exports = {
  name: 'npm',

  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
  },
  testMatch: ['<rootDir>/src/**/*.test.[jt]s'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: `tsconfig.json`,
    },
  },

  testEnvironment: 'node',
  modulePaths: ['src'],

  // reporter for circleci
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'junit',
        suiteNameTemplate: '{filepath}',
        ancestorSeparator: ' › ',
        addFileAttribute: 'true',
      },
    ],
  ],
};

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
};

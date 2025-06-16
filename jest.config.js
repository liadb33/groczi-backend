export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/api/**/*.test.ts'],
    transform: {
      '^.+\\.ts$': ['ts-jest', {
        useESM: true
      }],
    },
    collectCoverageFrom: [
      'backend/features/**/*.ts',
      '!**/*.d.ts',
      '!**/node_modules/**',
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    extensionsToTreatAsEsm: ['.ts'],
    testTimeout: 10000,
    verbose: true
  };
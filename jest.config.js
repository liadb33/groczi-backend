module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/api/**/*.test.ts'],
    transform: {
      '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
      'backend/features/**/*.ts',
      '!**/*.d.ts',
      '!**/node_modules/**',
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    moduleNameMapping: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  };
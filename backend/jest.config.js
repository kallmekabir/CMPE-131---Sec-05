const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
};

/** @type {import('jest').Config} */
const config = {
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/domain/**/*.ts',
    'src/validators/**/*.ts',
    'src/errors/**/*.ts',
    'src/middleware/**/*.ts',
    'src/adapters/**/*.ts',
  ],
  coverageThreshold: { global: { lines: 80, statements: 80 } },
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setupEnv.ts'],
      globalSetup: '<rootDir>/tests/globalSetup.ts',
    },
    {
      ...base,
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setupEnv.ts'],
      globalSetup: '<rootDir>/tests/globalSetup.ts',
    },
    {
      ...base,
      displayName: 'smoke',
      testMatch: ['<rootDir>/tests/smoke/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setupEnv.ts'],
      globalSetup: '<rootDir>/tests/globalSetup.ts',
    },
  ],
};

module.exports = config;

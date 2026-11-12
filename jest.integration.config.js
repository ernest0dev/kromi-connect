/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest');
require('dotenv').config({ path: '.env.local' });

const createJestConfig = nextJest({
  dir: './',
});

module.exports = createJestConfig({
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
});

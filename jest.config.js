/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest');
require('dotenv').config({ path: '.env.local' });

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)', '<rootDir>/tests/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/tests/integration/'],
  testEnvironment: 'node',
};

module.exports = createJestConfig(customJestConfig);

const nextJest = require('next/jest');
require('dotenv').config({ path: '.env.local' });

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
};

module.exports = createJestConfig(customJestConfig);
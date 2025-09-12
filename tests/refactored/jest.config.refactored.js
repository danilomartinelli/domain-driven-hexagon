/**
 * Jest configuration for refactored component tests
 * Optimized for performance testing and comprehensive coverage
 */

const baseConfig = require('../../jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Refactored Components',
  testMatch: [
    '<rootDir>/tests/refactored/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    '<rootDir>/src/libs/db/strategies/**/*.ts',
    '<rootDir>/src/libs/security/password-validator.ts',
    '<rootDir>/src/libs/database/config/**/*.ts',
    '<rootDir>/src/modules/user/domain/specifications/**/*.ts',
    '!**/*.d.ts',
    '!**/*.interface.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/refactored',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // Specific thresholds for critical components
    '<rootDir>/src/libs/security/password-validator.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    '<rootDir>/src/libs/db/strategies/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  // Performance testing configuration
  setupFilesAfterEnv: [
    '<rootDir>/tests/refactored/setup/performance-setup.ts',
  ],
  // Increase timeout for performance tests
  testTimeout: 30000,
  // Enable performance monitoring
  verbose: true,
  // Memory and performance optimization
  maxWorkers: '50%',
  //: true,
  // Custom test environment for performance testing
  testEnvironment: 'node',
  // Global variables for performance testing
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
    PERFORMANCE_TESTING: true,
    BENCHMARK_ITERATIONS: 100,
    MEMORY_LIMIT_MB: 512,
  },
  // Performance test reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/refactored/html-report',
        filename: 'performance-report.html',
        pageTitle: 'Refactored Components Performance Report',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/refactored',
        outputName: 'junit.xml',
        suiteName: 'Refactored Components Tests',
      },
    ],
  ],
  // Custom matchers for performance testing
  setupFilesAfterEnv: [
    ...baseConfig.setupFilesAfterEnv || [],
    '<rootDir>/tests/refactored/setup/performance-matchers.ts',
  ],
  // Module path mapping for test utilities
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '^@test-utils/(.*)$': '<rootDir>/tests/refactored/utils/$1',
  },
  // Transform configuration for performance testing
  transform: {
    ...baseConfig.transform,
    '^.+\\.performance\\.ts$': 'ts-jest',
  },
  // Test file patterns
  testRegex: [
    '(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$',
    '\\.performance\\.(js|ts)$',
  ],
  // Ignore patterns
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns || [],
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  // Cache configuration for faster test runs
  cacheDirectory: '<rootDir>/.jest-cache/refactored',
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  // Memory management
  logHeapUsage: true,
  // Force exit after tests complete
  forceExit: false,
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  // Custom test sequencer for performance tests
  testSequencer: '<rootDir>/tests/refactored/utils/performance-sequencer.js',
};
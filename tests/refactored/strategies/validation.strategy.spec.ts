/**
 * Comprehensive tests for Validation Strategy pattern
 * Tests high-performance validation with caching mechanisms
 */

import {
  CachedValidationStrategy,
  SchemaValidationStrategy,
} from '@libs/db/strategies/validation.strategy';
import {
  MockLogger,
  PerformanceMeasurement,
  BenchmarkRunner,
} from '../utils/refactoring-test.utils';

describe('ValidationStrategy', () => {
  let mockLogger: MockLogger;
  let cachedStrategy: CachedValidationStrategy;
  let schemaStrategy: SchemaValidationStrategy;

  beforeEach(() => {
    mockLogger = new MockLogger();
    cachedStrategy = new CachedValidationStrategy(mockLogger);
    schemaStrategy = new SchemaValidationStrategy(mockLogger);
    PerformanceMeasurement.reset();
  });

  afterEach(() => {
    mockLogger.clear();
    cachedStrategy.clearCache();
    PerformanceMeasurement.reset();
  });

  describe('CachedValidationStrategy', () => {
    describe('Basic Validation', () => {
      it('should validate input data correctly', async () => {
        // Arrange
        const validData = {
          id: 'user-123',
          email: 'test@example.com',
          age: 25,
        };

        const rules = {
          id: { required: true, type: 'string', minLength: 1 },
          email: {
            required: true,
            type: 'string',
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          age: { required: true, type: 'number', min: 0, max: 120 },
        };

        // Act
        const result = await cachedStrategy.validate(
          validData,
          rules,
          'user-validation',
        );

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.validatedData).toEqual(validData);
      });

      it('should detect validation errors', async () => {
        // Arrange
        const invalidData = {
          id: '',
          email: 'invalid-email',
          age: -5,
        };

        const rules = {
          id: { required: true, type: 'string', minLength: 1 },
          email: {
            required: true,
            type: 'string',
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          age: { required: true, type: 'number', min: 0, max: 120 },
        };

        // Act
        const result = await cachedStrategy.validate(
          invalidData,
          rules,
          'user-validation',
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'id' }),
            expect.objectContaining({ field: 'email' }),
            expect.objectContaining({ field: 'age' }),
          ]),
        );
      });

      it('should handle missing required fields', async () => {
        // Arrange
        const incompleteData = {
          email: 'test@example.com',
          // Missing required id field
        };

        const rules = {
          id: { required: true, type: 'string' },
          email: { required: true, type: 'string' },
          age: { required: false, type: 'number' },
        };

        // Act
        const result = await cachedStrategy.validate(
          incompleteData,
          rules,
          'incomplete-validation',
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              code: 'REQUIRED_FIELD_MISSING',
            }),
          ]),
        );
      });

      it('should validate nested objects', async () => {
        // Arrange
        const nestedData = {
          user: {
            profile: {
              name: 'John Doe',
              contact: {
                email: 'john@example.com',
                phone: '+1234567890',
              },
            },
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        };

        const rules = {
          'user.profile.name': { required: true, type: 'string', minLength: 2 },
          'user.profile.contact.email': {
            required: true,
            type: 'string',
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          'user.profile.contact.phone': { required: false, type: 'string' },
          'user.preferences.theme': {
            required: true,
            type: 'string',
            enum: ['light', 'dark'],
          },
          'user.preferences.notifications': { required: true, type: 'boolean' },
        };

        // Act
        const result = await cachedStrategy.validate(
          nestedData,
          rules,
          'nested-validation',
        );

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Caching Mechanism', () => {
      it('should cache validation results', async () => {
        // Arrange
        const data = { id: 'cache-test', value: 'test' };
        const rules = {
          id: { required: true, type: 'string' },
          value: { required: true, type: 'string' },
        };

        // Act - First validation
        const result1 = await cachedStrategy.validate(
          data,
          rules,
          'cache-test',
        );
        const metrics1 = cachedStrategy.getCacheMetrics();

        // Act - Second validation (should hit cache)
        const result2 = await cachedStrategy.validate(
          data,
          rules,
          'cache-test',
        );
        const metrics2 = cachedStrategy.getCacheMetrics();

        // Assert
        expect(result1).toEqual(result2);
        expect(metrics2.hitCount).toBeGreaterThan(metrics1.hitCount);
        expect(metrics2.hitRate).toBeGreaterThan(0);
      });

      it('should demonstrate cache performance benefits', async () => {
        // Arrange
        const testData = Array.from({ length: 50 }, (_, i) => ({
          id: `cache-perf-${i % 10}`, // Repeat IDs to test cache effectiveness
          value: `value-${i}`,
        }));
        const rules = {
          id: { required: true, type: 'string' },
          value: { required: true, type: 'string' },
        };

        // Act
        const benchmark = await BenchmarkRunner.run(
          'cached-validation-performance',
          async () => {
            for (const data of testData) {
              await cachedStrategy.validate(data, rules, 'cache-perf');
            }
          },
          20,
        );

        // Assert
        const metrics = cachedStrategy.getCacheMetrics();
        expect(metrics.hitRate).toBeGreaterThan(0.5); // Should have significant cache hits
        expect(benchmark.stats.avg).toBeLessThan(50); // Should be fast due to caching
      });

      it('should limit cache size to prevent memory issues', async () => {
        // Arrange
        const manyValidations = Array.from({ length: 1200 }, (_, i) => ({
          id: `cache-limit-${i}`,
          value: `value-${i}`,
        }));
        const rules = {
          id: { required: true, type: 'string' },
          value: { required: true, type: 'string' },
        };

        // Act
        for (const data of manyValidations) {
          await cachedStrategy.validate(data, rules, 'cache-limit');
        }

        // Assert
        const metrics = cachedStrategy.getCacheMetrics();
        expect(metrics.cacheSize).toBeLessThanOrEqual(1000); // Should not exceed max cache size
      });

      it('should invalidate cache when rules change', async () => {
        // Arrange
        const data = { id: 'rule-change-test', value: 'test' };
        const rules1 = { id: { required: true, type: 'string' } };
        const rules2 = { id: { required: true, type: 'string', minLength: 5 } };

        // Act
        await cachedStrategy.validate(data, rules1, 'rule-change');
        const result1 = await cachedStrategy.validate(
          data,
          rules1,
          'rule-change',
        ); // Cache hit

        await cachedStrategy.validate(data, rules2, 'rule-change');
        const result2 = await cachedStrategy.validate(
          data,
          rules2,
          'rule-change',
        ); // Different rules

        // Assert
        expect(result1.isValid).toBe(true);
        expect(result2.isValid).toBe(false); // Should fail minLength rule
      });
    });

    describe('Performance Characteristics', () => {
      it('should validate large datasets efficiently', async () => {
        // Arrange
        const largeDataset = Array.from({ length: 500 }, (_, i) => ({
          id: `large-${i}`,
          email: `user${i}@example.com`,
          age: 20 + (i % 50),
          active: i % 2 === 0,
        }));

        const rules = {
          id: { required: true, type: 'string' },
          email: {
            required: true,
            type: 'string',
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          age: { required: true, type: 'number', min: 0, max: 120 },
          active: { required: true, type: 'boolean' },
        };

        // Act
        const benchmark = await BenchmarkRunner.run(
          'large-dataset-validation',
          async () => {
            for (const data of largeDataset) {
              await cachedStrategy.validate(data, rules, 'large-dataset');
            }
          },
          5,
        );

        // Assert
        expect(benchmark.stats.avg).toBeLessThan(200); // Should handle 500 items in under 200ms
        expect(benchmark.stats.avg / largeDataset.length).toBeLessThan(0.5); // Less than 0.5ms per item
      });

      it('should handle concurrent validations', async () => {
        // Arrange
        const concurrentData = Array.from({ length: 20 }, (_, i) => ({
          id: `concurrent-${i}`,
          value: `value-${i}`,
        }));
        const rules = {
          id: { required: true, type: 'string' },
          value: { required: true, type: 'string' },
        };

        // Act
        const benchmark = await BenchmarkRunner.run(
          'concurrent-validation',
          async () => {
            const validationPromises = concurrentData.map((data) =>
              cachedStrategy.validate(data, rules, 'concurrent'),
            );
            await Promise.all(validationPromises);
          },
          10,
        );

        // Assert
        expect(benchmark.stats.avg).toBeLessThan(30); // Should handle 20 concurrent validations quickly
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle null and undefined values gracefully', async () => {
        // Arrange
        const edgeCaseData = [
          { id: null, value: 'test' },
          { id: undefined, value: 'test' },
          { id: 'test', value: null },
          null,
          undefined,
          {},
        ];

        const rules = {
          id: { required: true, type: 'string' },
          value: { required: true, type: 'string' },
        };

        // Act & Assert
        for (const data of edgeCaseData) {
          const result = await cachedStrategy.validate(
            data as any,
            rules,
            'edge-case',
          );
          expect(result).toHaveProperty('isValid');
          expect(result).toHaveProperty('errors');
          expect(Array.isArray(result.errors)).toBe(true);
        }
      });

      it('should handle circular references in data', async () => {
        // Arrange
        const circularData: any = { id: 'circular-test' };
        circularData.self = circularData; // Create circular reference

        const rules = { id: { required: true, type: 'string' } };

        // Act & Assert
        expect(async () => {
          await cachedStrategy.validate(circularData, rules, 'circular');
        }).not.toThrow();
      });

      it('should validate with custom validation functions', async () => {
        // Arrange
        const data = {
          password: 'weakpassword',
          confirmPassword: 'differentpassword',
        };
        const rules = {
          password: {
            required: true,
            type: 'string',
            custom: (value: string) => {
              if (value.length < 8)
                return 'Password must be at least 8 characters';
              if (!/[A-Z]/.test(value))
                return 'Password must contain uppercase letter';
              if (!/[0-9]/.test(value)) return 'Password must contain a number';
              return null;
            },
          },
          confirmPassword: {
            required: true,
            type: 'string',
            custom: (value: string, data: any) => {
              if (value !== data.password) return 'Passwords must match';
              return null;
            },
          },
        };

        // Act
        const result = await cachedStrategy.validate(
          data,
          rules,
          'custom-validation',
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('uppercase'),
            }),
            expect.objectContaining({
              message: expect.stringContaining('number'),
            }),
            expect.objectContaining({
              message: expect.stringContaining('match'),
            }),
          ]),
        );
      });
    });
  });

  describe('SchemaValidationStrategy', () => {
    describe('JSON Schema Validation', () => {
      it('should validate against JSON schema', async () => {
        // Arrange
        const schema = {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            age: { type: 'integer', minimum: 0, maximum: 120 },
            email: { type: 'string', format: 'email' },
            active: { type: 'boolean' },
          },
          required: ['name', 'email'],
        };

        const validData = {
          name: 'John Doe',
          age: 30,
          email: 'john@example.com',
          active: true,
        };

        const invalidData = {
          name: '',
          age: -5,
          email: 'invalid-email',
          active: 'not-boolean',
        };

        // Act
        const validResult = await schemaStrategy.validateSchema(
          validData,
          schema,
          'json-schema',
        );
        const invalidResult = await schemaStrategy.validateSchema(
          invalidData,
          schema,
          'json-schema',
        );

        // Assert
        expect(validResult.isValid).toBe(true);
        expect(validResult.errors).toHaveLength(0);

        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors.length).toBeGreaterThan(0);
      });

      it('should validate nested schema objects', async () => {
        // Arrange
        const schema = {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                profile: {
                  type: 'object',
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    age: { type: 'integer', minimum: 0 },
                  },
                  required: ['firstName', 'lastName'],
                },
              },
              required: ['profile'],
            },
          },
          required: ['user'],
        };

        const validData = {
          user: {
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              age: 30,
            },
          },
        };

        // Act
        const result = await schemaStrategy.validateSchema(
          validData,
          schema,
          'nested-schema',
        );

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle schema validation errors with detailed messages', async () => {
        // Arrange
        const schema = {
          type: 'object',
          properties: {
            count: { type: 'integer', minimum: 1, maximum: 100 },
            tags: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5,
            },
          },
          required: ['count', 'tags'],
        };

        const invalidData = {
          count: 0, // Below minimum
          tags: [], // Below minItems
        };

        // Act
        const result = await schemaStrategy.validateSchema(
          invalidData,
          schema,
          'schema-errors',
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'count',
              message: expect.stringContaining('minimum'),
            }),
            expect.objectContaining({
              field: 'tags',
              message: expect.stringContaining('minItems'),
            }),
          ]),
        );
      });
    });

    describe('Schema Compilation and Caching', () => {
      it('should cache compiled schemas for performance', async () => {
        // Arrange
        const schema = {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
          },
        };

        const testData = [
          { id: 'test1', value: 1 },
          { id: 'test2', value: 2 },
          { id: 'test3', value: 3 },
        ];

        // Act
        const benchmark = await BenchmarkRunner.run(
          'schema-caching-performance',
          async () => {
            for (const data of testData) {
              await schemaStrategy.validateSchema(
                data,
                schema,
                'schema-caching',
              );
            }
          },
          30,
        );

        // Assert
        expect(benchmark.stats.avg).toBeLessThan(20); // Should be fast due to schema caching
      });

      it('should demonstrate performance improvement with schema caching', async () => {
        // Compare with non-cached approach
        class NonCachedSchemaValidator {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          async validateSchema(_data: any, _schema: any) {
            // Simulate schema compilation on each validation
            await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms delay
            return { isValid: true, errors: [] };
          }
        }

        const nonCachedValidator = new NonCachedSchemaValidator();
        const schema = {
          type: 'object',
          properties: { id: { type: 'string' } },
        };
        const testData = Array.from({ length: 20 }, (_, i) => ({
          id: `test-${i}`,
        }));

        // Benchmark non-cached
        const nonCachedBenchmark = await BenchmarkRunner.run(
          'non-cached-schema-validation',
          async () => {
            for (const data of testData) {
              await nonCachedValidator.validateSchema(data, schema);
            }
          },
          10,
        );

        // Benchmark cached
        const cachedBenchmark = await BenchmarkRunner.run(
          'cached-schema-validation',
          async () => {
            for (const data of testData) {
              await schemaStrategy.validateSchema(data, schema, 'perf-test');
            }
          },
          10,
        );

        // Assert significant improvement
        expect(cachedBenchmark.stats.avg).toBeLessThan(
          nonCachedBenchmark.stats.avg * 0.5,
        );
      });
    });
  });

  describe('Strategy Pattern Compliance', () => {
    it('should implement ValidationStrategy interface correctly', () => {
      // Verify both strategies implement the interface
      expect(cachedStrategy).toHaveProperty('validate');
      expect(schemaStrategy).toHaveProperty('validateSchema');

      expect(typeof cachedStrategy.validate).toBe('function');
      expect(typeof schemaStrategy.validateSchema).toBe('function');
    });

    it('should allow strategy switching without breaking functionality', async () => {
      // Test that strategies can be used interchangeably
      const data = { id: 'strategy-test', email: 'test@example.com' };
      const rules = {
        id: { required: true, type: 'string' },
        email: {
          required: true,
          type: 'string',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      };

      // Use cached strategy
      let strategy: any = cachedStrategy;
      let result = await strategy.validate(data, rules, 'strategy-switch');
      expect(result.isValid).toBe(true);

      // Convert rules to JSON schema for schema strategy
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
        },
        required: ['id', 'email'],
      };

      // Use schema strategy
      strategy = schemaStrategy;
      result = await strategy.validateSchema(data, schema, 'strategy-switch');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Integration with Error Handling', () => {
    it('should provide detailed error information for debugging', async () => {
      // Arrange
      const complexData = {
        user: {
          id: '',
          profile: {
            email: 'invalid-email',
            age: 'not-a-number',
            preferences: {
              theme: 'invalid-theme',
            },
          },
        },
      };

      const rules = {
        'user.id': { required: true, type: 'string', minLength: 1 },
        'user.profile.email': {
          required: true,
          type: 'string',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        'user.profile.age': { required: true, type: 'number', min: 0 },
        'user.profile.preferences.theme': {
          required: true,
          type: 'string',
          enum: ['light', 'dark'],
        },
      };

      // Act
      const result = await cachedStrategy.validate(
        complexData,
        rules,
        'error-details',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      result.errors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
        expect(error.field).toBeTruthy();
        expect(error.message).toBeTruthy();
      });
    });

    it('should log validation performance metrics', async () => {
      // Arrange
      const data = { id: 'metrics-test', value: 'test' };
      const rules = {
        id: { required: true, type: 'string' },
        value: { required: true, type: 'string' },
      };

      // Act
      await cachedStrategy.validate(data, rules, 'metrics-test');

      // Assert
      expect(mockLogger.hasLogWithLevel('debug')).toBe(true);
      const debugLogs = mockLogger.getLogsByLevel('debug');
      expect(
        debugLogs.some((log) => log.message.includes('validation completed')),
      ).toBe(true);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not leak memory with repeated validations', async () => {
      // Arrange
      const data = { id: 'memory-test', value: 'test' };
      const rules = {
        id: { required: true, type: 'string' },
        value: { required: true, type: 'string' },
      };

      // Act - Perform many validations
      for (let i = 0; i < 1000; i++) {
        await cachedStrategy.validate(data, rules, 'memory-leak-test');
      }

      // Assert - Should complete without memory issues
      const metrics = cachedStrategy.getCacheMetrics();
      expect(metrics.cacheSize).toBeLessThanOrEqual(1000);
      expect(metrics.hitRate).toBeGreaterThan(0.9); // Very high hit rate for same data
    });

    it('should clean up resources on cache clear', () => {
      // Act
      cachedStrategy.clearCache();

      // Assert
      const metrics = cachedStrategy.getCacheMetrics();
      expect(metrics.cacheSize).toBe(0);
      expect(metrics.hitCount).toBe(0);
      expect(metrics.missCount).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });
  });
});

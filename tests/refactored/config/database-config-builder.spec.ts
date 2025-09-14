/**
 * Comprehensive tests for DatabaseConfigurationBuilder
 * Tests type-safe configuration system with validation chains and environment profiles
 */

import {
  DatabaseConfigurationBuilder,
  DatabaseConfigValidationError,
} from '@libs/database/config/database-config.builder';
import {
  DatabaseEnvironment,
  DatabaseEnvironmentVariables,
  DatabaseSslMode,
} from '@libs/database/config/database-config.types';
import { EnvironmentTestUtils } from '../utils/refactoring-test.utils';

describe('DatabaseConfigurationBuilder', () => {
  let builder: DatabaseConfigurationBuilder;
  let environmentUtils: EnvironmentTestUtils;

  beforeEach(() => {
    builder = new DatabaseConfigurationBuilder();
    environmentUtils = EnvironmentTestUtils.create();
  });

  afterEach(() => {
    environmentUtils.restore();
  });

  describe('Configuration Building', () => {
    describe('Environment Variable Loading and Validation', () => {
      it('should load and validate valid environment variables', () => {
        // Arrange
        const validEnvVars = environmentUtils.createTestEnvironmentVariables();

        // Act
        const result = builder.build(validEnvVars);

        // Assert
        expect(result.config).toBeDefined();
        expect(result.environment).toBe(DatabaseEnvironment.TEST);
        expect(result.source).toBe('environment');
        expect(result.config.connection.host).toBe('localhost');
        expect(result.config.connection.port).toBe(5432);
        expect(result.config.connection.username).toBe('testuser');
        expect(result.config.connection.database).toBe('testdb');
      });

      it('should throw validation error for invalid environment variables', () => {
        // Arrange
        const invalidEnvVars =
          environmentUtils.createInvalidEnvironmentVariables();

        // Act & Assert
        expect(() => builder.build(invalidEnvVars)).toThrow(
          DatabaseConfigValidationError,
        );
      });

      it('should validate port ranges', () => {
        // Arrange
        const invalidPortConfigs = [
          { ...environmentUtils.createTestEnvironmentVariables(), DB_PORT: 0 },
          {
            ...environmentUtils.createTestEnvironmentVariables(),
            DB_PORT: 99999,
          },
          { ...environmentUtils.createTestEnvironmentVariables(), DB_PORT: -1 },
        ];

        invalidPortConfigs.forEach((config) => {
          // Act & Assert
          expect(() => builder.build(config)).toThrow(
            expect.objectContaining({
              field: 'DB_PORT',
              constraint: 'port_range',
            }),
          );
        });
      });

      it('should validate pool size constraints', () => {
        // Arrange
        const invalidPoolConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          DB_MIN_POOL_SIZE: 10,
          DB_MAX_POOL_SIZE: 5, // Max less than min
        };

        // Act & Assert
        expect(() => builder.build(invalidPoolConfig)).toThrow(
          expect.objectContaining({
            field: 'pool.minimumPoolSize',
            constraint: 'pool_size_relationship',
          }),
        );
      });

      it('should validate timeout constraints', () => {
        // Arrange
        const invalidTimeoutConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          DB_CONNECTION_TIMEOUT: 500, // Too short
        };

        // Act & Assert
        expect(() => builder.build(invalidTimeoutConfig)).toThrow(
          expect.objectContaining({
            field: 'connectionTimeoutMillis',
            constraint: 'min_timeout',
          }),
        );
      });
    });

    describe('Environment Detection', () => {
      it('should detect production environment correctly', () => {
        // Arrange
        const prodEnvVars = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
        };

        // Act
        const result = builder.build(prodEnvVars);

        // Assert
        expect(result.environment).toBe(DatabaseEnvironment.PRODUCTION);
        expect(result.config.environment).toBe(DatabaseEnvironment.PRODUCTION);
      });

      it('should detect development environment as fallback', () => {
        // Arrange
        const envVars = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: undefined,
        };
        delete envVars.NODE_ENV;

        // Act
        const result = builder.build(envVars);

        // Assert
        expect(result.environment).toBe(DatabaseEnvironment.DEVELOPMENT);
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining('Environment defaulted to DEVELOPMENT'),
          ]),
        );
      });

      it('should detect test environment from CI indicators', () => {
        // Arrange
        environmentUtils.setEnvironmentVariables({ CI: 'true' });
        const envVars = environmentUtils.createTestEnvironmentVariables();
        delete envVars.NODE_ENV;

        // Act
        const result = builder.build(envVars);

        // Assert
        expect(result.environment).toBe(DatabaseEnvironment.TEST);
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining('Environment detected as TEST based on CI'),
          ]),
        );
      });
    });

    describe('SSL Configuration', () => {
      it('should build SSL configuration for production', () => {
        // Arrange
        const prodEnvVars = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
          DB_SSL: true,
          DB_SSL_MODE: DatabaseSslMode.REQUIRE,
          DB_SSL_REJECT_UNAUTHORIZED: true,
          DB_SSL_CA: '/path/to/ca.pem',
          DB_SSL_CERT: '/path/to/cert.pem',
          DB_SSL_KEY: '/path/to/key.pem',
        };

        // Act
        const result = builder.build(prodEnvVars);

        // Assert
        expect(result.config.connection.ssl).toEqual({
          enabled: true,
          mode: DatabaseSslMode.REQUIRE,
          rejectUnauthorized: true,
          ca: '/path/to/ca.pem',
          cert: '/path/to/cert.pem',
          key: '/path/to/key.pem',
        });
      });

      it('should disable SSL for development when not specified', () => {
        // Arrange
        const devEnvVars = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.DEVELOPMENT,
          DB_SSL: false,
        };

        // Act
        const result = builder.build(devEnvVars);

        // Assert
        expect(result.config.connection.ssl).toBeUndefined();
      });

      it('should use recommended SSL defaults per environment', () => {
        const environments = [
          { env: DatabaseEnvironment.PRODUCTION, expectedSslEnabled: true },
          { env: DatabaseEnvironment.DEVELOPMENT, expectedSslEnabled: false },
          { env: DatabaseEnvironment.TEST, expectedSslEnabled: false },
        ];

        environments.forEach(({ env, expectedSslEnabled }) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            NODE_ENV: env,
            // Don't specify SSL settings to use defaults
            DB_SSL: undefined,
          };
          delete envVars.DB_SSL;

          // Act
          const result = builder.build(envVars);

          // Assert
          if (expectedSslEnabled) {
            expect(result.config.connection.ssl?.enabled).toBe(true);
          } else {
            expect(result.config.connection.ssl).toBeUndefined();
          }
        });
      });
    });
  });

  describe('Configuration Merging', () => {
    it('should merge profile defaults with environment overrides', () => {
      // Arrange
      const envOverrides = {
        ...environmentUtils.createTestEnvironmentVariables(),
        NODE_ENV: DatabaseEnvironment.DEVELOPMENT,
        DB_MAX_POOL_SIZE: 15, // Override default
        DB_CONNECTION_TIMEOUT: 45000, // Override default
      };

      // Act
      const result = builder.build(envOverrides);

      // Assert
      expect(result.config.pool.maximumPoolSize).toBe(15);
      expect(result.config.timeouts.connectionTimeoutMillis).toBe(45000);
      expect(result.source).toBe('environment');
    });

    it('should use profile defaults when no environment overrides', () => {
      // Arrange - Minimal environment variables
      const minimalEnvVars: Partial<DatabaseEnvironmentVariables> = {
        NODE_ENV: DatabaseEnvironment.DEVELOPMENT,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_USERNAME: 'testuser',
        DB_PASSWORD: 'testpass',
        DB_NAME: 'testdb',
      };

      // Act
      const result = builder.build(minimalEnvVars);

      // Assert
      expect(result.source).toBe('profile');
      expect(result.config.pool).toBeDefined();
      expect(result.config.timeouts).toBeDefined();
      expect(result.config.healthCheck).toBeDefined();
      expect(result.config.logging).toBeDefined();
    });

    it('should handle partial environment overrides correctly', () => {
      // Arrange
      const partialEnvVars = {
        ...environmentUtils.createTestEnvironmentVariables(),
        DB_MAX_POOL_SIZE: 25, // Only override this
        // Leave other pool settings as defaults
        DB_MIN_POOL_SIZE: undefined,
      };
      delete partialEnvVars.DB_MIN_POOL_SIZE;

      // Act
      const result = builder.build(partialEnvVars);

      // Assert
      expect(result.config.pool.maximumPoolSize).toBe(25); // Overridden
      expect(result.config.pool.minimumPoolSize).toBeDefined(); // From profile default
      expect(result.config.pool.minimumPoolSize).toBeGreaterThan(0);
    });
  });

  describe('Validation Chain', () => {
    describe('Pool Configuration Validation', () => {
      it('should validate pool size relationships', () => {
        const invalidPoolConfigs = [
          { minSize: 10, maxSize: 5 }, // Min > Max
          { minSize: 0, maxSize: 10 }, // Min too low
          { minSize: 5, maxSize: 200 }, // Max too high
        ];

        invalidPoolConfigs.forEach(({ minSize, maxSize }) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            DB_MIN_POOL_SIZE: minSize,
            DB_MAX_POOL_SIZE: maxSize,
          };

          // Act & Assert
          expect(() => builder.build(envVars)).toThrow(
            DatabaseConfigValidationError,
          );
        });
      });

      it('should generate performance warnings for pool configuration', () => {
        // Arrange
        const highPoolConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.DEVELOPMENT,
          DB_MAX_POOL_SIZE: 25, // High for development
        };

        // Act
        const result = builder.build(highPoolConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'Large pool size (25) may be unnecessary for development',
            ),
          ]),
        );
      });

      it('should warn about short idle timeouts', () => {
        // Arrange
        const shortIdleConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          DB_IDLE_TIMEOUT: 30000, // 30 seconds (short)
        };

        // Act
        const result = builder.build(shortIdleConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'Short idle timeout may cause frequent connection cycling',
            ),
          ]),
        );
      });
    });

    describe('Timeout Configuration Validation', () => {
      it('should validate timeout ranges', () => {
        const invalidTimeouts = [
          { field: 'DB_CONNECTION_TIMEOUT', value: 100 }, // Too short
          { field: 'DB_STATEMENT_TIMEOUT', value: 300001 }, // Too long
          { field: 'DB_QUERY_TIMEOUT', value: 0 }, // Zero
        ];

        invalidTimeouts.forEach(({ field, value }) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            [field]: value,
          };

          // Act & Assert
          expect(() => builder.build(envVars)).toThrow(
            expect.objectContaining({
              field: expect.stringContaining('TimeoutMillis'),
            }),
          );
        });
      });

      it('should warn about timeout relationship inconsistencies', () => {
        // Arrange
        const inconsistentTimeouts = {
          ...environmentUtils.createTestEnvironmentVariables(),
          DB_QUERY_TIMEOUT: 60000, // 60 seconds
          DB_STATEMENT_TIMEOUT: 30000, // 30 seconds (query > statement is unusual)
        };

        // Act
        const result = builder.build(inconsistentTimeouts);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'Query timeout should typically be less than statement timeout',
            ),
          ]),
        );
      });
    });

    describe('Health Check Configuration Validation', () => {
      it('should validate health check intervals', () => {
        const invalidHealthCheckConfigs = [
          { interval: 500, expectedError: 'min_health_check_interval' },
          { interval: 600001, expectedError: 'max_health_check_interval' },
        ];

        invalidHealthCheckConfigs.forEach(({ interval, expectedError }) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            DB_HEALTH_CHECK_INTERVAL: interval,
          };

          // Act & Assert
          expect(() => builder.build(envVars)).toThrow(
            expect.objectContaining({
              constraint: expectedError,
            }),
          );
        });
      });

      it('should validate health check retry counts', () => {
        const invalidRetryConfigs = [0, 11, -1]; // Outside 1-10 range

        invalidRetryConfigs.forEach((retries) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            DB_HEALTH_CHECK_RETRIES: retries,
          };

          // Act & Assert
          expect(() => builder.build(envVars)).toThrow(
            expect.objectContaining({
              field: 'healthCheck.retries',
              constraint: 'health_check_retries_range',
            }),
          );
        });
      });
    });

    describe('Security Configuration Validation', () => {
      it('should warn about insecure production settings', () => {
        // Arrange
        const insecureProdConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
          DB_SSL: false, // Insecure for production
          DB_ENABLE_QUERY_LOGGING: true, // May expose sensitive data
        };

        // Act
        const result = builder.build(insecureProdConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'SSL is recommended for production environments',
            ),
            expect.stringContaining(
              'Query logging may expose sensitive data in production',
            ),
          ]),
        );
      });

      it('should warn about SSL certificate validation disabled', () => {
        // Arrange
        const insecureSslConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
          DB_SSL: true,
          DB_SSL_REJECT_UNAUTHORIZED: false, // Insecure
        };

        // Act
        const result = builder.build(insecureSslConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'SSL certificate validation should be enabled in production',
            ),
          ]),
        );
      });
    });

    describe('Performance Configuration Validation', () => {
      it('should provide performance recommendations by environment', () => {
        const environmentTests = [
          {
            env: DatabaseEnvironment.PRODUCTION,
            poolSize: 5,
            expectedWarning:
              'Consider increasing pool size for production workloads',
          },
          {
            env: DatabaseEnvironment.TEST,
            poolSize: 15,
            expectedWarning:
              'Consider reducing pool size for test environments to save resources',
          },
        ];

        environmentTests.forEach(({ env, poolSize, expectedWarning }) => {
          // Arrange
          const envVars = {
            ...environmentUtils.createTestEnvironmentVariables(),
            NODE_ENV: env,
            DB_MAX_POOL_SIZE: poolSize,
          };

          // Act
          const result = builder.build(envVars);

          // Assert
          expect(result.warnings).toEqual(
            expect.arrayContaining([expect.stringContaining(expectedWarning)]),
          );
        });
      });

      it('should warn about very short query timeouts in production', () => {
        // Arrange
        const shortTimeoutConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
          DB_QUERY_TIMEOUT: 3000, // Very short for production
        };

        // Act
        const result = builder.build(shortTimeoutConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'Very short query timeout may cause premature query cancellation in production',
            ),
          ]),
        );
      });

      it('should recommend enabling monitoring in production', () => {
        // Arrange
        const noMonitoringConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          NODE_ENV: DatabaseEnvironment.PRODUCTION,
          DB_ENABLE_POOL_MONITORING: false,
        };

        // Act
        const result = builder.build(noMonitoringConfig);

        // Assert
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              'Enable monitoring for production environments',
            ),
          ]),
        );
      });
    });
  });

  describe('Custom Constraints', () => {
    it('should accept custom validation constraints', () => {
      // Arrange
      const customConstraints = {
        minPoolSize: 5, // Higher than default
        maxPoolSize: 50, // Higher than default
        minTimeoutMs: 10000, // Higher than default
      };
      const customBuilder =
        DatabaseConfigurationBuilder.withConstraints(customConstraints);

      // Test with pool size that would be valid with default constraints but invalid with custom
      const envVars = {
        ...environmentUtils.createTestEnvironmentVariables(),
        DB_MIN_POOL_SIZE: 3, // Below custom minimum
      };

      // Act & Assert
      expect(() => customBuilder.build(envVars)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'Minimum pool size must be at least 5',
          ),
        }),
      );
    });

    it('should validate custom timeout constraints', () => {
      // Arrange
      const strictConstraints = {
        minTimeoutMs: 20000, // 20 seconds minimum
      };
      const strictBuilder =
        DatabaseConfigurationBuilder.withConstraints(strictConstraints);

      const envVars = {
        ...environmentUtils.createTestEnvironmentVariables(),
        DB_CONNECTION_TIMEOUT: 15000, // Below custom minimum
      };

      // Act & Assert
      expect(() => strictBuilder.build(envVars)).toThrow(
        expect.objectContaining({
          constraint: 'min_timeout',
        }),
      );
    });
  });

  describe('Type Safety and Schema Validation', () => {
    it('should enforce type safety through Zod schema validation', () => {
      // Arrange - Type mismatches that Zod should catch
      const typeMismatchConfigs = [
        { DB_PORT: 'not-a-number' },
        { DB_SSL: 'maybe' }, // Not a boolean
        { DB_MAX_POOL_SIZE: 'infinite' },
        { DB_ENABLE_QUERY_LOGGING: 'yes' }, // Not a boolean
      ];

      typeMismatchConfigs.forEach((config) => {
        // Arrange
        const invalidConfig = {
          ...environmentUtils.createTestEnvironmentVariables(),
          ...config,
        };

        // Act & Assert
        expect(() => builder.build(invalidConfig)).toThrow(
          DatabaseConfigValidationError,
        );
      });
    });

    it('should provide detailed validation error information', () => {
      // Arrange
      const invalidConfig = {
        ...environmentUtils.createTestEnvironmentVariables(),
        DB_PORT: 'invalid-port',
      };

      // Act & Assert
      try {
        builder.build(invalidConfig);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseConfigValidationError);
        expect(error.field).toBeDefined();
        expect(error.value).toBeDefined();
        expect(error.message).toContain('validation failed');
      }
    });

    it('should validate enum values correctly', () => {
      // Arrange
      const invalidEnumConfig = {
        ...environmentUtils.createTestEnvironmentVariables(),
        NODE_ENV: 'invalid-environment' as any,
        DB_SSL_MODE: 'invalid-mode' as any,
      };

      // Act & Assert
      expect(() => builder.build(invalidEnumConfig)).toThrow(
        DatabaseConfigValidationError,
      );
    });
  });

  describe('Configuration Result Structure', () => {
    it('should return complete configuration result structure', () => {
      // Arrange
      const envVars = environmentUtils.createTestEnvironmentVariables();

      // Act
      const result = builder.build(envVars);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          config: expect.objectContaining({
            environment: expect.any(String),
            connection: expect.objectContaining({
              host: expect.any(String),
              port: expect.any(Number),
              username: expect.any(String),
              password: expect.any(String),
              database: expect.any(String),
            }),
            pool: expect.objectContaining({
              minimumPoolSize: expect.any(Number),
              maximumPoolSize: expect.any(Number),
              acquireTimeoutMillis: expect.any(Number),
            }),
            timeouts: expect.objectContaining({
              connectionTimeoutMillis: expect.any(Number),
              statementTimeoutMillis: expect.any(Number),
              queryTimeoutMillis: expect.any(Number),
            }),
            healthCheck: expect.objectContaining({
              intervalMs: expect.any(Number),
              timeoutMs: expect.any(Number),
              retries: expect.any(Number),
            }),
            logging: expect.objectContaining({
              level: expect.any(String),
              enableQueryLogging: expect.any(Boolean),
            }),
            migration: expect.objectContaining({
              tableName: expect.any(String),
              migrationsPath: expect.any(String),
            }),
            monitoring: expect.objectContaining({
              enabled: expect.any(Boolean),
              poolMonitoringIntervalMs: expect.any(Number),
            }),
            resilience: expect.any(Object),
          }),
          warnings: expect.any(Array),
          environment: expect.any(String),
          source: expect.stringMatching(/^(profile|environment)$/),
        }),
      );
    });

    it('should maintain configuration immutability', () => {
      // Arrange
      const envVars = environmentUtils.createTestEnvironmentVariables();

      // Act
      const result = builder.build(envVars);
      const originalPoolSize = result.config.pool.maximumPoolSize;

      // Try to modify configuration
      (result.config.pool as any).maximumPoolSize = 999;

      // Assert - Configuration should be immutable or protected
      expect(result.config.pool.maximumPoolSize).toBe(originalPoolSize);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should handle malformed environment variables gracefully', () => {
      // Arrange
      const malformedEnvVars = {
        DB_HOST: 'localhost',
        DB_PORT: 'five-four-three-two', // Malformed number
        DB_USERNAME: 'user',
        DB_PASSWORD: 'pass',
        DB_NAME: 'db',
      };

      // Act & Assert
      expect(() => builder.build(malformedEnvVars as any)).toThrow(
        DatabaseConfigValidationError,
      );
    });

    it('should provide helpful error messages for configuration issues', () => {
      // Arrange
      const problematicConfig = {
        ...environmentUtils.createTestEnvironmentVariables(),
        DB_MIN_POOL_SIZE: 20,
        DB_MAX_POOL_SIZE: 10, // Logical error
      };

      // Act & Assert
      try {
        builder.build(problematicConfig);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain(
          'Minimum pool size must be less than maximum pool size',
        );
        expect(error.field).toBe('pool.minimumPoolSize');
        expect(error.constraint).toBe('pool_size_relationship');
      }
    });

    it('should handle missing required environment variables', () => {
      // Arrange - Missing critical environment variables
      const incompleteConfig = {
        DB_HOST: 'localhost',
        // Missing DB_PORT, DB_USERNAME, etc.
      };

      // Act & Assert
      expect(() => builder.build(incompleteConfig as any)).toThrow(
        DatabaseConfigValidationError,
      );
    });
  });
});

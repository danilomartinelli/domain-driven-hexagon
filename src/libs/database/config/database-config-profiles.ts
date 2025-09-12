import {
  DatabaseConfiguration,
  DatabaseEnvironment,
  DatabaseLogLevel,
  DatabaseSslMode,
} from './database-config.types';

/**
 * Type-safe database configuration profiles for different environments.
 * These profiles provide optimized defaults for specific environments
 * while maintaining the ability to override through environment variables.
 */
export class DatabaseConfigProfiles {
  /**
   * Development environment profile - Optimized for development workflow
   * - Moderate pool size for good performance without resource waste
   * - Debug logging enabled for troubleshooting
   * - Relaxed SSL requirements for local development
   * - Fast timeouts for rapid feedback
   */
  static readonly DEVELOPMENT: Omit<DatabaseConfiguration, 'connection'> = {
    environment: DatabaseEnvironment.DEVELOPMENT,
    
    pool: {
      maximumPoolSize: 10,
      minimumPoolSize: 2,
      acquireTimeoutMillis: 15000,
      createTimeoutMillis: 15000,
      destroyTimeoutMillis: 3000,
      idleTimeoutMillis: 180000, // 3 minutes - Keep connections alive longer in dev
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },

    timeouts: {
      connectionTimeoutMillis: 15000,
      statementTimeoutMillis: 30000, // Allow longer queries in development
      queryTimeoutMillis: 15000,
    },

    healthCheck: {
      enabled: true,
      intervalMs: 60000, // 1 minute - Less frequent in development
      timeoutMs: 5000,
      retries: 2,
      testQuery: 'SELECT 1',
      validateOnBorrow: true,
      validateOnReturn: false,
      validatePeriodically: true,
      validationIntervalMs: 30000,
    },

    logging: {
      level: DatabaseLogLevel.DEBUG,
      enableQueryLogging: true,
      enableSlowQueryLogging: true,
      slowQueryThresholdMs: 1000, // Log queries > 1 second
      enableErrorLogging: true,
      enablePerformanceLogging: true,
    },

    migration: {
      tableName: 'migration',
      migrationsPath: './database/migrations',
      enableAutoMigration: true, // Auto-migrate in development
      validateChecksums: false, // Allow checksum changes in dev
    },

    monitoring: {
      enabled: true,
      poolMonitoringIntervalMs: 60000,
      metricsCollectionEnabled: true,
      performanceTrackingEnabled: true,
      connectionLeakDetectionEnabled: true,
      connectionLeakThresholdMs: 60000,
    },

    resilience: {
      maxConnectionRetries: 3,
      connectionRetryDelayMs: 1000,
      connectionRetryBackoffMultiplier: 1.5,
      enableCircuitBreaker: false, // Disable in development for easier debugging
      circuitBreakerFailureThreshold: 5,
      circuitBreakerRecoveryTimeoutMs: 30000,
    },
  } as const;

  /**
   * Test environment profile - Optimized for automated testing
   * - Smaller pool size for parallel test execution
   * - Fast timeouts for quick test execution
   * - Minimal logging to reduce test output noise
   * - Disabled features that might interfere with tests
   */
  static readonly TEST: Omit<DatabaseConfiguration, 'connection'> = {
    environment: DatabaseEnvironment.TEST,

    pool: {
      maximumPoolSize: 5, // Smaller pool for test isolation
      minimumPoolSize: 1,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 2000,
      idleTimeoutMillis: 60000, // 1 minute - Shorter for test cleanup
      reapIntervalMillis: 500, // More frequent cleanup
      createRetryIntervalMillis: 100,
    },

    timeouts: {
      connectionTimeoutMillis: 10000,
      statementTimeoutMillis: 20000,
      queryTimeoutMillis: 10000,
    },

    healthCheck: {
      enabled: true,
      intervalMs: 30000, // Less frequent in tests
      timeoutMs: 3000,
      retries: 1, // Fail fast in tests
      testQuery: 'SELECT 1',
      validateOnBorrow: true,
      validateOnReturn: false,
      validatePeriodically: false, // Disable periodic validation in tests
      validationIntervalMs: 60000,
    },

    logging: {
      level: DatabaseLogLevel.WARN, // Minimal logging in tests
      enableQueryLogging: false,
      enableSlowQueryLogging: false,
      slowQueryThresholdMs: 5000,
      enableErrorLogging: true,
      enablePerformanceLogging: false,
    },

    migration: {
      tableName: 'migration',
      migrationsPath: './database/migrations',
      enableAutoMigration: false, // Manual migration control in tests
      validateChecksums: true,
    },

    monitoring: {
      enabled: false, // Disable monitoring in tests
      poolMonitoringIntervalMs: 30000,
      metricsCollectionEnabled: false,
      performanceTrackingEnabled: false,
      connectionLeakDetectionEnabled: false,
      connectionLeakThresholdMs: 30000,
    },

    resilience: {
      maxConnectionRetries: 2, // Faster failure in tests
      connectionRetryDelayMs: 500,
      connectionRetryBackoffMultiplier: 1.5,
      enableCircuitBreaker: false,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerRecoveryTimeoutMs: 10000,
    },
  } as const;

  /**
   * Production environment profile - Optimized for production workloads
   * - Large pool size for high concurrency
   * - Error-only logging for performance
   * - Strict SSL requirements for security
   * - Long timeouts for stability
   * - Full monitoring and resilience features enabled
   */
  static readonly PRODUCTION: Omit<DatabaseConfiguration, 'connection'> = {
    environment: DatabaseEnvironment.PRODUCTION,

    pool: {
      maximumPoolSize: 25, // Large pool for production load
      minimumPoolSize: 5, // Maintain minimum connections
      acquireTimeoutMillis: 45000, // Longer timeouts for stability
      createTimeoutMillis: 45000,
      destroyTimeoutMillis: 10000,
      idleTimeoutMillis: 600000, // 10 minutes - Keep connections longer
      reapIntervalMillis: 2000,
      createRetryIntervalMillis: 500,
    },

    timeouts: {
      connectionTimeoutMillis: 45000,
      statementTimeoutMillis: 120000, // 2 minutes for complex queries
      queryTimeoutMillis: 45000,
    },

    healthCheck: {
      enabled: true,
      intervalMs: 30000, // Regular health checks
      timeoutMs: 5000,
      retries: 3, // More retries for reliability
      testQuery: 'SELECT 1',
      validateOnBorrow: true,
      validateOnReturn: true, // Validate on return in production
      validatePeriodically: true,
      validationIntervalMs: 30000,
    },

    logging: {
      level: DatabaseLogLevel.ERROR, // Minimal logging in production
      enableQueryLogging: false, // Disabled for performance
      enableSlowQueryLogging: true, // Monitor slow queries
      slowQueryThresholdMs: 5000, // 5 second threshold
      enableErrorLogging: true,
      enablePerformanceLogging: false, // Use external APM instead
    },

    migration: {
      tableName: 'migration',
      migrationsPath: './database/migrations',
      enableAutoMigration: false, // Manual migration in production
      validateChecksums: true, // Strict validation
    },

    monitoring: {
      enabled: true,
      poolMonitoringIntervalMs: 30000,
      metricsCollectionEnabled: true,
      performanceTrackingEnabled: true,
      connectionLeakDetectionEnabled: true,
      connectionLeakThresholdMs: 300000, // 5 minutes
    },

    resilience: {
      maxConnectionRetries: 5, // More retries for stability
      connectionRetryDelayMs: 1000,
      connectionRetryBackoffMultiplier: 2,
      enableCircuitBreaker: true,
      circuitBreakerFailureThreshold: 10,
      circuitBreakerRecoveryTimeoutMs: 60000,
    },
  } as const;

  /**
   * Get configuration profile by environment
   */
  static getProfile(environment: DatabaseEnvironment): Omit<DatabaseConfiguration, 'connection'> {
    switch (environment) {
      case DatabaseEnvironment.DEVELOPMENT:
        return this.DEVELOPMENT;
      case DatabaseEnvironment.TEST:
        return this.TEST;
      case DatabaseEnvironment.PRODUCTION:
        return this.PRODUCTION;
      default:
        // Fallback to development profile for unknown environments
        return this.DEVELOPMENT;
    }
  }

  /**
   * Get all available profiles as a map
   */
  static getAllProfiles(): Map<DatabaseEnvironment, Omit<DatabaseConfiguration, 'connection'>> {
    return new Map([
      [DatabaseEnvironment.DEVELOPMENT, this.DEVELOPMENT],
      [DatabaseEnvironment.TEST, this.TEST],
      [DatabaseEnvironment.PRODUCTION, this.PRODUCTION],
    ]);
  }

  /**
   * Validate that a profile has sensible values
   */
  static validateProfile(
    environment: DatabaseEnvironment,
    profile: Omit<DatabaseConfiguration, 'connection'>,
  ): string[] {
    const warnings: string[] = [];

    // Pool size validation
    if (profile.pool.minimumPoolSize >= profile.pool.maximumPoolSize) {
      warnings.push(`${environment}: Minimum pool size should be less than maximum pool size`);
    }

    if (profile.pool.maximumPoolSize > 50 && environment !== DatabaseEnvironment.PRODUCTION) {
      warnings.push(`${environment}: Large pool size (${profile.pool.maximumPoolSize}) may not be necessary`);
    }

    // Timeout validation
    if (profile.timeouts.queryTimeoutMillis > profile.timeouts.statementTimeoutMillis) {
      warnings.push(`${environment}: Query timeout should not exceed statement timeout`);
    }

    // Logging validation for production
    if (environment === DatabaseEnvironment.PRODUCTION) {
      if (profile.logging.level === DatabaseLogLevel.DEBUG) {
        warnings.push(`${environment}: Debug logging in production may impact performance`);
      }
      
      if (profile.logging.enableQueryLogging) {
        warnings.push(`${environment}: Query logging in production may impact performance`);
      }
    }

    // Health check validation
    if (!profile.healthCheck.enabled && environment === DatabaseEnvironment.PRODUCTION) {
      warnings.push(`${environment}: Health checks should be enabled in production`);
    }

    return warnings;
  }

  /**
   * Get recommended SSL configuration for each environment
   */
  static getRecommendedSslConfig(environment: DatabaseEnvironment): {
    enabled: boolean;
    mode?: DatabaseSslMode;
    rejectUnauthorized?: boolean;
  } {
    switch (environment) {
      case DatabaseEnvironment.DEVELOPMENT:
        return {
          enabled: false, // SSL optional in development
          mode: DatabaseSslMode.PREFER,
          rejectUnauthorized: false,
        };
      
      case DatabaseEnvironment.TEST:
        return {
          enabled: false, // SSL typically disabled in test
          mode: DatabaseSslMode.DISABLE,
          rejectUnauthorized: false,
        };
      
      case DatabaseEnvironment.PRODUCTION:
        return {
          enabled: true, // SSL required in production
          mode: DatabaseSslMode.REQUIRE,
          rejectUnauthorized: true,
        };
      
      default:
        return {
          enabled: false,
          mode: DatabaseSslMode.PREFER,
          rejectUnauthorized: false,
        };
    }
  }
}
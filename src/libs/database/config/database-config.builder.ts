import {
  DatabaseConfiguration,
  DatabaseEnvironment,
  DatabaseEnvironmentVariables,
  DatabaseEnvironmentVariablesSchema,
  DatabaseConnectionConfig,
  DatabaseSslConfig,
  DatabaseConfigurationResult,
  DEFAULT_DATABASE_CONFIG_CONSTRAINTS,
} from './database-config.types';
import { DatabaseConfigProfiles } from './database-config-profiles';

/**
 * Configuration validation error
 */
export class DatabaseConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint?: string,
  ) {
    super(message);
    this.name = 'DatabaseConfigValidationError';
  }
}

/**
 * Advanced database configuration builder with validation chain pattern
 *
 * Features:
 * - Environment variable validation with Zod schemas
 * - Type-safe configuration profiles
 * - Constraint validation with detailed error messages
 * - Configuration merging with precedence rules
 * - Security validation for production environments
 * - Performance optimization suggestions
 */
export class DatabaseConfigurationBuilder {
  private readonly constraints = DEFAULT_DATABASE_CONFIG_CONSTRAINTS;
  private readonly warnings: string[] = [];

  /**
   * Build complete database configuration from environment variables
   * with profile defaults and validation
   */
  build(
    environmentOverrides: Partial<DatabaseEnvironmentVariables> = {},
  ): DatabaseConfigurationResult {
    try {
      // Step 1: Load and validate environment variables
      const envVars =
        this.loadAndValidateEnvironmentVariables(environmentOverrides);

      // Step 2: Determine environment and get profile
      const environment = this.determineEnvironment(envVars);
      const profileConfig = DatabaseConfigProfiles.getProfile(environment);

      // Step 3: Build connection configuration from environment
      const connectionConfig = this.buildConnectionConfig(envVars);

      // Step 4: Merge profile with environment overrides
      const mergedConfig = this.mergeConfigWithEnvironmentOverrides(
        profileConfig,
        envVars,
      );

      // Step 5: Create complete configuration
      const completeConfig: DatabaseConfiguration = {
        connection: connectionConfig,
        ...mergedConfig,
        environment, // Ensure environment override takes precedence
      };

      // Step 6: Validate complete configuration
      this.validateCompleteConfiguration(completeConfig);

      // Step 7: Add profile validation warnings
      const profileWarnings = DatabaseConfigProfiles.validateProfile(
        environment,
        mergedConfig,
      );
      this.warnings.push(...profileWarnings);

      return {
        config: completeConfig,
        warnings: [...this.warnings],
        environment,
        source: this.hasEnvironmentOverrides(envVars)
          ? 'environment'
          : 'profile',
      };
    } catch (error) {
      if (error instanceof DatabaseConfigValidationError) {
        throw error;
      }
      throw new DatabaseConfigValidationError(
        `Configuration building failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown',
        undefined,
      );
    }
  }

  /**
   * Load and validate environment variables using Zod schema
   */
  private loadAndValidateEnvironmentVariables(
    overrides: Partial<DatabaseEnvironmentVariables>,
  ): DatabaseEnvironmentVariables {
    try {
      // Merge process.env with overrides
      const rawEnvVars = {
        ...process.env,
        ...overrides,
      };

      // Parse and validate with Zod schema
      const validatedEnvVars =
        DatabaseEnvironmentVariablesSchema.parse(rawEnvVars);

      return validatedEnvVars;
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as any;
        const firstError = zodError.errors[0];
        throw new DatabaseConfigValidationError(
          `Environment variable validation failed: ${firstError.message}`,
          firstError.path.join('.'),
          firstError.received,
          firstError.code,
        );
      }
      throw new DatabaseConfigValidationError(
        `Environment variable validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'environment',
        undefined,
      );
    }
  }

  /**
   * Determine the current environment with fallback logic
   */
  private determineEnvironment(
    envVars: DatabaseEnvironmentVariables,
  ): DatabaseEnvironment {
    // Check explicit NODE_ENV first
    if (
      envVars.NODE_ENV &&
      Object.values(DatabaseEnvironment).includes(envVars.NODE_ENV)
    ) {
      return envVars.NODE_ENV;
    }

    // Fallback detection based on environment characteristics
    if (process.env.CI === 'true' || process.env.NODE_ENV?.includes('test')) {
      this.warnings.push(
        'Environment detected as TEST based on CI/test indicators',
      );
      return DatabaseEnvironment.TEST;
    }

    if (process.env.NODE_ENV === 'production' || process.env.PROD === 'true') {
      this.warnings.push(
        'Environment detected as PRODUCTION based on production indicators',
      );
      return DatabaseEnvironment.PRODUCTION;
    }

    // Default to development
    this.warnings.push(
      'Environment defaulted to DEVELOPMENT - set NODE_ENV explicitly',
    );
    return DatabaseEnvironment.DEVELOPMENT;
  }

  /**
   * Build connection configuration from validated environment variables
   */
  private buildConnectionConfig(
    envVars: DatabaseEnvironmentVariables,
  ): DatabaseConnectionConfig {
    // Validate port range
    if (
      envVars.DB_PORT < this.constraints.minPort ||
      envVars.DB_PORT > this.constraints.maxPort
    ) {
      throw new DatabaseConfigValidationError(
        `Database port must be between ${this.constraints.minPort} and ${this.constraints.maxPort}`,
        'DB_PORT',
        envVars.DB_PORT,
        'port_range',
      );
    }

    // Build SSL configuration
    const sslConfig = this.buildSslConfig(envVars);

    return {
      host: envVars.DB_HOST,
      port: envVars.DB_PORT,
      username: envVars.DB_USERNAME,
      password: envVars.DB_PASSWORD,
      database: envVars.DB_NAME,
      ssl: sslConfig,
    };
  }

  /**
   * Build SSL configuration with environment-specific defaults
   */
  private buildSslConfig(
    envVars: DatabaseEnvironmentVariables,
  ): DatabaseSslConfig | undefined {
    const environment = this.determineEnvironment(envVars);
    const recommendedSsl =
      DatabaseConfigProfiles.getRecommendedSslConfig(environment);

    // Use environment variables if provided, otherwise use recommended defaults
    const sslEnabled = envVars.DB_SSL ?? recommendedSsl.enabled;

    if (!sslEnabled) {
      return undefined;
    }

    // Build SSL config object with all properties at once
    const sslConfig: DatabaseSslConfig = {
      enabled: true,
      mode: envVars.DB_SSL_MODE ?? recommendedSsl.mode,
      rejectUnauthorized:
        envVars.DB_SSL_REJECT_UNAUTHORIZED ?? recommendedSsl.rejectUnauthorized,
      ...(envVars.DB_SSL_CA && { ca: envVars.DB_SSL_CA }),
      ...(envVars.DB_SSL_CERT && { cert: envVars.DB_SSL_CERT }),
      ...(envVars.DB_SSL_KEY && { key: envVars.DB_SSL_KEY }),
    };

    return sslConfig;
  }

  /**
   * Merge profile configuration with environment variable overrides
   */
  private mergeConfigWithEnvironmentOverrides(
    profileConfig: Omit<DatabaseConfiguration, 'connection'>,
    envVars: DatabaseEnvironmentVariables,
  ): Omit<DatabaseConfiguration, 'connection'> {
    return {
      environment: profileConfig.environment,

      pool: {
        ...profileConfig.pool,
        ...(envVars.DB_MAX_POOL_SIZE && {
          maximumPoolSize: envVars.DB_MAX_POOL_SIZE,
        }),
        ...(envVars.DB_MIN_POOL_SIZE && {
          minimumPoolSize: envVars.DB_MIN_POOL_SIZE,
        }),
        ...(envVars.DB_ACQUIRE_TIMEOUT && {
          acquireTimeoutMillis: envVars.DB_ACQUIRE_TIMEOUT,
        }),
        ...(envVars.DB_CREATE_TIMEOUT && {
          createTimeoutMillis: envVars.DB_CREATE_TIMEOUT,
        }),
        ...(envVars.DB_DESTROY_TIMEOUT && {
          destroyTimeoutMillis: envVars.DB_DESTROY_TIMEOUT,
        }),
        ...(envVars.DB_IDLE_TIMEOUT && {
          idleTimeoutMillis: envVars.DB_IDLE_TIMEOUT,
        }),
      },

      timeouts: {
        ...profileConfig.timeouts,
        ...(envVars.DB_CONNECTION_TIMEOUT && {
          connectionTimeoutMillis: envVars.DB_CONNECTION_TIMEOUT,
        }),
        ...(envVars.DB_STATEMENT_TIMEOUT && {
          statementTimeoutMillis: envVars.DB_STATEMENT_TIMEOUT,
        }),
        ...(envVars.DB_QUERY_TIMEOUT && {
          queryTimeoutMillis: envVars.DB_QUERY_TIMEOUT,
        }),
      },

      healthCheck: {
        ...profileConfig.healthCheck,
        ...(envVars.DB_HEALTH_CHECK_INTERVAL && {
          intervalMs: envVars.DB_HEALTH_CHECK_INTERVAL,
        }),
        ...(envVars.DB_HEALTH_CHECK_TIMEOUT && {
          timeoutMs: envVars.DB_HEALTH_CHECK_TIMEOUT,
        }),
        ...(envVars.DB_HEALTH_CHECK_RETRIES && {
          retries: envVars.DB_HEALTH_CHECK_RETRIES,
        }),
      },

      logging: {
        ...profileConfig.logging,
        ...(envVars.DB_LOG_LEVEL && { level: envVars.DB_LOG_LEVEL }),
        ...(envVars.DB_ENABLE_QUERY_LOGGING !== undefined && {
          enableQueryLogging: envVars.DB_ENABLE_QUERY_LOGGING,
        }),
      },

      migration: {
        ...profileConfig.migration,
        ...(envVars.DB_MIGRATION_TABLE && {
          tableName: envVars.DB_MIGRATION_TABLE,
        }),
        ...(envVars.DB_MIGRATIONS_PATH && {
          migrationsPath: envVars.DB_MIGRATIONS_PATH,
        }),
      },

      monitoring: {
        ...profileConfig.monitoring,
        ...(envVars.DB_ENABLE_POOL_MONITORING !== undefined && {
          enabled: envVars.DB_ENABLE_POOL_MONITORING,
        }),
        ...(envVars.DB_POOL_MONITORING_INTERVAL && {
          poolMonitoringIntervalMs: envVars.DB_POOL_MONITORING_INTERVAL,
        }),
      },

      resilience: profileConfig.resilience,
    };
  }

  /**
   * Validate the complete configuration for consistency and constraints
   */
  private validateCompleteConfiguration(config: DatabaseConfiguration): void {
    this.validatePoolConfiguration(config);
    this.validateTimeoutConfiguration(config);
    this.validateHealthCheckConfiguration(config);
    this.validateSecurityConfiguration(config);
    this.validatePerformanceConfiguration(config);
  }

  /**
   * Validate pool configuration constraints
   */
  private validatePoolConfiguration(config: DatabaseConfiguration): void {
    const { pool } = config;

    if (pool.minimumPoolSize < this.constraints.minPoolSize) {
      throw new DatabaseConfigValidationError(
        `Minimum pool size must be at least ${this.constraints.minPoolSize}`,
        'pool.minimumPoolSize',
        pool.minimumPoolSize,
        'min_pool_size',
      );
    }

    if (pool.maximumPoolSize > this.constraints.maxPoolSize) {
      throw new DatabaseConfigValidationError(
        `Maximum pool size must not exceed ${this.constraints.maxPoolSize}`,
        'pool.maximumPoolSize',
        pool.maximumPoolSize,
        'max_pool_size',
      );
    }

    if (pool.minimumPoolSize >= pool.maximumPoolSize) {
      throw new DatabaseConfigValidationError(
        'Minimum pool size must be less than maximum pool size',
        'pool.minimumPoolSize',
        pool.minimumPoolSize,
        'pool_size_relationship',
      );
    }

    // Performance warnings
    if (
      pool.maximumPoolSize > 20 &&
      config.environment !== DatabaseEnvironment.PRODUCTION
    ) {
      this.warnings.push(
        `Large pool size (${pool.maximumPoolSize}) may be unnecessary for ${config.environment}`,
      );
    }

    if (pool.idleTimeoutMillis < 60000) {
      this.warnings.push(
        'Short idle timeout may cause frequent connection cycling',
      );
    }
  }

  /**
   * Validate timeout configuration constraints
   */
  private validateTimeoutConfiguration(config: DatabaseConfiguration): void {
    const { timeouts } = config;

    const timeoutFields = [
      {
        name: 'connectionTimeoutMillis',
        value: timeouts.connectionTimeoutMillis,
      },
      {
        name: 'statementTimeoutMillis',
        value: timeouts.statementTimeoutMillis,
      },
      { name: 'queryTimeoutMillis', value: timeouts.queryTimeoutMillis },
    ];

    for (const field of timeoutFields) {
      if (field.value < this.constraints.minTimeoutMs) {
        throw new DatabaseConfigValidationError(
          `${field.name} must be at least ${this.constraints.minTimeoutMs}ms`,
          field.name,
          field.value,
          'min_timeout',
        );
      }

      if (field.value > this.constraints.maxTimeoutMs) {
        throw new DatabaseConfigValidationError(
          `${field.name} must not exceed ${this.constraints.maxTimeoutMs}ms`,
          field.name,
          field.value,
          'max_timeout',
        );
      }
    }

    // Logical relationship validation
    if (timeouts.queryTimeoutMillis > timeouts.statementTimeoutMillis) {
      this.warnings.push(
        'Query timeout should typically be less than statement timeout',
      );
    }
  }

  /**
   * Validate health check configuration
   */
  private validateHealthCheckConfiguration(
    config: DatabaseConfiguration,
  ): void {
    const { healthCheck } = config;

    if (healthCheck.intervalMs < this.constraints.minHealthCheckInterval) {
      throw new DatabaseConfigValidationError(
        `Health check interval must be at least ${this.constraints.minHealthCheckInterval}ms`,
        'healthCheck.intervalMs',
        healthCheck.intervalMs,
        'min_health_check_interval',
      );
    }

    if (healthCheck.intervalMs > this.constraints.maxHealthCheckInterval) {
      throw new DatabaseConfigValidationError(
        `Health check interval must not exceed ${this.constraints.maxHealthCheckInterval}ms`,
        'healthCheck.intervalMs',
        healthCheck.intervalMs,
        'max_health_check_interval',
      );
    }

    if (healthCheck.retries < 1 || healthCheck.retries > 10) {
      throw new DatabaseConfigValidationError(
        'Health check retries must be between 1 and 10',
        'healthCheck.retries',
        healthCheck.retries,
        'health_check_retries_range',
      );
    }
  }

  /**
   * Validate security configuration for production environments
   */
  private validateSecurityConfiguration(config: DatabaseConfiguration): void {
    if (config.environment === DatabaseEnvironment.PRODUCTION) {
      // SSL validation
      if (!config.connection.ssl?.enabled) {
        this.warnings.push('SSL is recommended for production environments');
      }

      if (
        config.connection.ssl?.enabled &&
        !config.connection.ssl.rejectUnauthorized
      ) {
        this.warnings.push(
          'SSL certificate validation should be enabled in production',
        );
      }

      // Logging validation
      if (config.logging.enableQueryLogging) {
        this.warnings.push(
          'Query logging may expose sensitive data in production',
        );
      }
    }
  }

  /**
   * Validate performance configuration and add optimization suggestions
   */
  private validatePerformanceConfiguration(
    config: DatabaseConfiguration,
  ): void {
    // Pool size recommendations
    const poolSize = config.pool.maximumPoolSize;
    const environment = config.environment;

    if (environment === DatabaseEnvironment.PRODUCTION && poolSize < 10) {
      this.warnings.push(
        'Consider increasing pool size for production workloads',
      );
    }

    if (environment === DatabaseEnvironment.TEST && poolSize > 10) {
      this.warnings.push(
        'Consider reducing pool size for test environments to save resources',
      );
    }

    // Timeout recommendations
    if (
      config.timeouts.queryTimeoutMillis < 5000 &&
      environment === DatabaseEnvironment.PRODUCTION
    ) {
      this.warnings.push(
        'Very short query timeout may cause premature query cancellation in production',
      );
    }

    // Monitoring recommendations
    if (
      !config.monitoring.enabled &&
      environment === DatabaseEnvironment.PRODUCTION
    ) {
      this.warnings.push('Enable monitoring for production environments');
    }
  }

  /**
   * Check if environment variables contain any overrides
   */
  private hasEnvironmentOverrides(
    envVars: DatabaseEnvironmentVariables,
  ): boolean {
    const overrideFields = [
      'DB_MAX_POOL_SIZE',
      'DB_MIN_POOL_SIZE',
      'DB_CONNECTION_TIMEOUT',
      'DB_STATEMENT_TIMEOUT',
      'DB_QUERY_TIMEOUT',
      'DB_LOG_LEVEL',
      'DB_ENABLE_QUERY_LOGGING',
      'DB_HEALTH_CHECK_INTERVAL',
    ];

    return overrideFields.some(
      (field) =>
        envVars[field as keyof DatabaseEnvironmentVariables] !== undefined,
    );
  }

  /**
   * Create a configuration builder with custom constraints
   */
  static withConstraints(
    constraints: Partial<typeof DEFAULT_DATABASE_CONFIG_CONSTRAINTS>,
  ): DatabaseConfigurationBuilder {
    const builder = new DatabaseConfigurationBuilder();
    Object.assign(builder.constraints, constraints);
    return builder;
  }
}

import { get } from 'env-var';
import '../libs/utils/dotenv';
import { DatabaseModuleOptions } from '@libs/database';
import { Guard } from '@libs/guard';

// https://github.com/Sairyss/backend-best-practices#configuration

/**
 * Environment-aware database log levels
 */
const DATABASE_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type DatabaseLogLevel = (typeof DATABASE_LOG_LEVELS)[number];

/**
 * Type-safe environment checking utilities
 */
const Environment = {
  isProduction: () => process.env.NODE_ENV === 'production',
  isTest: () => process.env.NODE_ENV === 'test',
  isDevelopment: () => process.env.NODE_ENV === 'development',
  current: () => process.env.NODE_ENV || 'development',
} as const;

/**
 * Database configuration constraints for validation
 */
const DB_CONSTRAINTS = {
  pool: {
    min: 1,
    max: 100,
  },
  timeouts: {
    min: 1000, // 1 second
    max: 300000, // 5 minutes
  },
  healthCheck: {
    min: 5000, // 5 seconds
    max: 300000, // 5 minutes
  },
} as const;

/**
 * Enhanced database configuration with production-ready settings and validation
 */
export const databaseConfig: DatabaseModuleOptions = {
  // Connection settings
  host: get('DB_HOST').required().asString(),
  port: get('DB_PORT').required().asIntPositive(),
  username: get('DB_USERNAME').required().asString(),
  password: get('DB_PASSWORD').required().asString(),
  database: get('DB_NAME').required().asString(),

  // SSL configuration
  ssl: get('DB_SSL').default('false').asBool(),
  sslRejectUnauthorized: get('DB_SSL_REJECT_UNAUTHORIZED')
    .default('true')
    .asBool(),

  // Connection pool settings optimized for production
  maximumPoolSize: get('DB_MAX_POOL_SIZE').default('25').asIntPositive(), // Increased for better concurrency
  minimumPoolSize: get('DB_MIN_POOL_SIZE').default('10').asIntPositive(), // Higher minimum for faster response
  acquireTimeoutMillis: get('DB_ACQUIRE_TIMEOUT')
    .default('15000')
    .asIntPositive(), // Reduced to fail faster
  createTimeoutMillis: get('DB_CREATE_TIMEOUT')
    .default('10000')
    .asIntPositive(), // Reduced for faster failure detection
  destroyTimeoutMillis: get('DB_DESTROY_TIMEOUT')
    .default('3000')
    .asIntPositive(), // Faster cleanup
  idleTimeoutMillis: get('DB_IDLE_TIMEOUT').default('180000').asIntPositive(), // 3 minutes - more aggressive cleanup
  reapIntervalMillis: get('DB_REAP_INTERVAL').default('5000').asIntPositive(), // Less frequent reaping
  createRetryIntervalMillis: get('DB_CREATE_RETRY_INTERVAL')
    .default('500')
    .asIntPositive(), // Slightly longer retry interval

  // Query timeout settings
  connectionTimeoutMillis: get('DB_CONNECTION_TIMEOUT')
    .default('30000')
    .asIntPositive(),
  statementTimeoutMillis: get('DB_STATEMENT_TIMEOUT')
    .default('60000')
    .asIntPositive(),
  queryTimeoutMillis: get('DB_QUERY_TIMEOUT').default('30000').asIntPositive(),

  // Health check configuration
  healthCheckIntervalMs: get('DB_HEALTH_CHECK_INTERVAL')
    .default('30000')
    .asIntPositive(),

  // Migration settings
  migrationTableName: get('DB_MIGRATION_TABLE').default('migration').asString(),
  migrationsPath: get('DB_MIGRATIONS_PATH')
    .default('./database/migrations')
    .asString(),

  // Logging configuration
  logLevel: get('DB_LOG_LEVEL')
    .default('info')
    .asEnum(['debug', 'info', 'warn', 'error']) as
    | 'debug'
    | 'info'
    | 'warn'
    | 'error',
  enableQueryLogging: get('DB_ENABLE_QUERY_LOGGING').default('false').asBool(),
};

/**
 * Validate database configuration values
 */
function validateDatabaseConfig(config: DatabaseModuleOptions): void {
  // Validate pool sizes
  if (!Guard.isPositiveNumber(config.maximumPoolSize)) {
    throw new Error('maximumPoolSize must be a positive number');
  }

  if (!Guard.isPositiveNumber(config.minimumPoolSize)) {
    throw new Error('minimumPoolSize must be a positive number');
  }

  if (config.minimumPoolSize >= config.maximumPoolSize) {
    throw new Error('minimumPoolSize must be less than maximumPoolSize');
  }

  if (config.maximumPoolSize > DB_CONSTRAINTS.pool.max) {
    throw new Error(`maximumPoolSize cannot exceed ${DB_CONSTRAINTS.pool.max}`);
  }

  // Validate timeouts
  const timeouts = [
    { name: 'connectionTimeoutMillis', value: config.connectionTimeoutMillis },
    { name: 'statementTimeoutMillis', value: config.statementTimeoutMillis },
    { name: 'queryTimeoutMillis', value: config.queryTimeoutMillis },
    { name: 'acquireTimeoutMillis', value: config.acquireTimeoutMillis },
    { name: 'createTimeoutMillis', value: config.createTimeoutMillis },
    { name: 'destroyTimeoutMillis', value: config.destroyTimeoutMillis },
    { name: 'idleTimeoutMillis', value: config.idleTimeoutMillis },
  ];

  for (const timeout of timeouts) {
    if (!Guard.isPositiveNumber(timeout.value)) {
      throw new Error(`${timeout.name} must be a positive number`);
    }

    if (
      timeout.value < DB_CONSTRAINTS.timeouts.min ||
      timeout.value > DB_CONSTRAINTS.timeouts.max
    ) {
      throw new Error(
        `${timeout.name} must be between ${DB_CONSTRAINTS.timeouts.min} and ${DB_CONSTRAINTS.timeouts.max}`,
      );
    }
  }

  // Validate health check interval
  if (
    config.healthCheckIntervalMs &&
    (config.healthCheckIntervalMs < DB_CONSTRAINTS.healthCheck.min ||
      config.healthCheckIntervalMs > DB_CONSTRAINTS.healthCheck.max)
  ) {
    throw new Error(
      `healthCheckIntervalMs must be between ${DB_CONSTRAINTS.healthCheck.min} and ${DB_CONSTRAINTS.healthCheck.max}`,
    );
  }
}

/**
 * Get environment-specific database log level with type safety
 */
function getDatabaseLogLevel(): DatabaseLogLevel {
  const defaultLevel = Environment.isProduction() ? 'warn' : 'debug';
  const level = get('DB_LOG_LEVEL')
    .default(defaultLevel)
    .asEnum(DATABASE_LOG_LEVELS);
  return level as DatabaseLogLevel;
}

/**
 * Environment-specific database configuration with comprehensive validation
 */
export const getDatabaseConfig = (): DatabaseModuleOptions => {
  const config: DatabaseModuleOptions = {
    ...databaseConfig,

    // Environment-aware pool sizing
    maximumPoolSize: Environment.isTest()
      ? get('DB_MAX_POOL_SIZE').default('5').asIntPositive()
      : get('DB_MAX_POOL_SIZE').default('20').asIntPositive(),

    minimumPoolSize: Environment.isTest()
      ? get('DB_MIN_POOL_SIZE').default('1').asIntPositive()
      : get('DB_MIN_POOL_SIZE').default('5').asIntPositive(),

    // Environment-aware query logging
    enableQueryLogging: Environment.isProduction()
      ? get('DB_ENABLE_QUERY_LOGGING').default('false').asBool()
      : get('DB_ENABLE_QUERY_LOGGING').default('true').asBool(),

    // Type-safe log level configuration
    logLevel: getDatabaseLogLevel(),
  };

  // Validate configuration before returning
  validateDatabaseConfig(config);

  return config;
};

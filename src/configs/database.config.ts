import { get } from 'env-var';
import '../libs/utils/dotenv';
import { DatabaseModuleOptions } from '@libs/database';

// https://github.com/Sairyss/backend-best-practices#configuration

/**
 * Enhanced database configuration with production-ready settings
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
  maximumPoolSize: get('DB_MAX_POOL_SIZE').default('20').asIntPositive(),
  minimumPoolSize: get('DB_MIN_POOL_SIZE').default('5').asIntPositive(),
  acquireTimeoutMillis: get('DB_ACQUIRE_TIMEOUT')
    .default('30000')
    .asIntPositive(),
  createTimeoutMillis: get('DB_CREATE_TIMEOUT')
    .default('30000')
    .asIntPositive(),
  destroyTimeoutMillis: get('DB_DESTROY_TIMEOUT')
    .default('5000')
    .asIntPositive(),
  idleTimeoutMillis: get('DB_IDLE_TIMEOUT').default('300000').asIntPositive(), // 5 minutes
  reapIntervalMillis: get('DB_REAP_INTERVAL').default('1000').asIntPositive(),
  createRetryIntervalMillis: get('DB_CREATE_RETRY_INTERVAL')
    .default('200')
    .asIntPositive(),

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
 * Environment-specific database configuration
 */
export const getDatabaseConfig = (): DatabaseModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    ...databaseConfig,

    // Adjust pool size based on environment
    maximumPoolSize: isTest
      ? get('DB_MAX_POOL_SIZE').default('5').asIntPositive()
      : get('DB_MAX_POOL_SIZE').default('20').asIntPositive(),

    minimumPoolSize: isTest
      ? get('DB_MIN_POOL_SIZE').default('1').asIntPositive()
      : get('DB_MIN_POOL_SIZE').default('5').asIntPositive(),

    // Enable query logging in development
    enableQueryLogging: isProduction
      ? get('DB_ENABLE_QUERY_LOGGING').default('false').asBool()
      : get('DB_ENABLE_QUERY_LOGGING').default('true').asBool(),

    // Adjust log level based on environment
    logLevel: isProduction
      ? (get('DB_LOG_LEVEL')
          .default('warn')
          .asEnum(['debug', 'info', 'warn', 'error']) as
          | 'debug'
          | 'info'
          | 'warn'
          | 'error')
      : (get('DB_LOG_LEVEL')
          .default('debug')
          .asEnum(['debug', 'info', 'warn', 'error']) as
          | 'debug'
          | 'info'
          | 'warn'
          | 'error'),
  };
};

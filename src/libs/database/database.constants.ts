/**
 * Database module constants for dependency injection tokens
 */

export const DATABASE_POOL_TOKEN = Symbol('DATABASE_POOL');
export const DATABASE_CONFIG_TOKEN = Symbol('DATABASE_CONFIG');
export const DATABASE_MODULE_OPTIONS_TOKEN = Symbol('DATABASE_MODULE_OPTIONS');

/**
 * Default database configuration values
 */
export const DEFAULT_DATABASE_CONFIG = {
  // Connection pool settings
  maximumPoolSize: 20,
  minimumPoolSize: 5,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 300000, // 5 minutes
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,

  // Connection settings
  connectionTimeoutMillis: 30000,
  statementTimeoutMillis: 60000,
  queryTimeoutMillis: 30000,

  // Health check settings
  healthCheckIntervalMs: 30000,

  // Migration settings
  migrationTableName: 'migration',
  migrationsPath: './database/migrations',

  // Security settings
  ssl: false,
  sslRejectUnauthorized: true,

  // Logging
  logLevel: 'info' as const,
  enableQueryLogging: false,
} as const;

/**
 * Environment variable names for database configuration
 */
export const DATABASE_ENV_VARS = {
  HOST: 'DB_HOST',
  PORT: 'DB_PORT',
  USERNAME: 'DB_USERNAME',
  PASSWORD: 'DB_PASSWORD',
  DATABASE: 'DB_NAME',
  SSL: 'DB_SSL',
  SSL_REJECT_UNAUTHORIZED: 'DB_SSL_REJECT_UNAUTHORIZED',
  MAX_POOL_SIZE: 'DB_MAX_POOL_SIZE',
  MIN_POOL_SIZE: 'DB_MIN_POOL_SIZE',
  CONNECTION_TIMEOUT: 'DB_CONNECTION_TIMEOUT',
  STATEMENT_TIMEOUT: 'DB_STATEMENT_TIMEOUT',
  QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  LOG_LEVEL: 'DB_LOG_LEVEL',
  ENABLE_QUERY_LOGGING: 'DB_ENABLE_QUERY_LOGGING',
} as const;

/**
 * Database module constants for dependency injection tokens
 */

export const DATABASE_POOL_TOKEN = Symbol('DATABASE_POOL');
export const DATABASE_CONFIG_TOKEN = Symbol('DATABASE_CONFIG');
export const DATABASE_MODULE_OPTIONS_TOKEN = Symbol('DATABASE_MODULE_OPTIONS');

/**
 * Database configuration profiles for different environments
 */
export const DATABASE_CONFIG_PROFILES = {
  development: {
    maximumPoolSize: 10,
    minimumPoolSize: 2,
    acquireTimeoutMillis: 15000,
    createTimeoutMillis: 15000,
    destroyTimeoutMillis: 3000,
    idleTimeoutMillis: 180000, // 3 minutes
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
    connectionTimeoutMillis: 15000,
    statementTimeoutMillis: 30000,
    queryTimeoutMillis: 15000,
    healthCheckIntervalMs: 60000,
    logLevel: 'debug' as const,
    enableQueryLogging: true,
    ssl: false,
    sslRejectUnauthorized: false,
  },
  test: {
    maximumPoolSize: 5,
    minimumPoolSize: 1,
    acquireTimeoutMillis: 10000,
    createTimeoutMillis: 10000,
    destroyTimeoutMillis: 2000,
    idleTimeoutMillis: 60000, // 1 minute
    reapIntervalMillis: 500,
    createRetryIntervalMillis: 100,
    connectionTimeoutMillis: 10000,
    statementTimeoutMillis: 20000,
    queryTimeoutMillis: 10000,
    healthCheckIntervalMs: 30000,
    logLevel: 'warn' as const,
    enableQueryLogging: false,
    ssl: false,
    sslRejectUnauthorized: false,
  },
  production: {
    maximumPoolSize: 25,
    minimumPoolSize: 5,
    acquireTimeoutMillis: 45000,
    createTimeoutMillis: 45000,
    destroyTimeoutMillis: 10000,
    idleTimeoutMillis: 600000, // 10 minutes
    reapIntervalMillis: 2000,
    createRetryIntervalMillis: 500,
    connectionTimeoutMillis: 45000,
    statementTimeoutMillis: 120000,
    queryTimeoutMillis: 45000,
    healthCheckIntervalMs: 30000,
    logLevel: 'error' as const,
    enableQueryLogging: false,
    ssl: true,
    sslRejectUnauthorized: true,
  },
} as const;

/**
 * Default database configuration values (fallback for unknown environments)
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

  // Connection retry settings
  maxConnectionRetries: 3,
  connectionRetryDelayMs: 1000,
  connectionRetryBackoffMultiplier: 2,

  // Health check settings
  healthCheckTimeoutMs: 5000,
  healthCheckRetries: 2,

  // Pool monitoring
  enablePoolMonitoring: false,
  poolMonitoringIntervalMs: 60000,
} as const;

/**
 * Connection validation settings
 */
export const CONNECTION_VALIDATION = {
  testQuery: 'SELECT 1',
  validateOnBorrow: true,
  validateOnReturn: false,
  validatePeriodically: true,
  validationIntervalMs: 30000,
} as const;

/**
 * Configuration limits and constraints
 */
export const DATABASE_CONFIG_LIMITS = {
  minPoolSize: 1,
  maxPoolSize: 100,
  minTimeoutMs: 1000,
  maxTimeoutMs: 300000, // 5 minutes
  minHealthCheckInterval: 5000,
  maxHealthCheckInterval: 300000,
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

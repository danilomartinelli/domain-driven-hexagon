import { z } from 'zod';

/**
 * Environment types supported by the application
 */
export enum DatabaseEnvironment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * Database log levels with proper typing
 */
export enum DatabaseLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent',
}

/**
 * Database connection SSL modes
 */
export enum DatabaseSslMode {
  DISABLE = 'disable',
  PREFER = 'prefer',
  REQUIRE = 'require',
  VERIFY_CA = 'verify-ca',
  VERIFY_FULL = 'verify-full',
}

/**
 * Zod schema for environment variable validation
 */
export const DatabaseEnvironmentVariablesSchema = z.object({
  // Core connection settings
  DB_HOST: z.string().min(1, 'Database host is required'),
  DB_PORT: z
    .string()
    .regex(/^\d+$/, 'Database port must be a number')
    .transform(Number),
  DB_USERNAME: z.string().min(1, 'Database username is required'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
  DB_NAME: z.string().min(1, 'Database name is required'),

  // SSL configuration
  DB_SSL: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  DB_SSL_MODE: z.nativeEnum(DatabaseSslMode).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  DB_SSL_CA: z.string().optional(),
  DB_SSL_CERT: z.string().optional(),
  DB_SSL_KEY: z.string().optional(),

  // Pool configuration
  DB_MAX_POOL_SIZE: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_MIN_POOL_SIZE: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_ACQUIRE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_CREATE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_DESTROY_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_IDLE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),

  // Connection timeouts
  DB_CONNECTION_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_STATEMENT_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  DB_QUERY_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),

  // Logging configuration
  DB_LOG_LEVEL: z.nativeEnum(DatabaseLogLevel).optional(),
  DB_ENABLE_QUERY_LOGGING: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),

  // Health check settings
  DB_HEALTH_CHECK_INTERVAL: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  DB_HEALTH_CHECK_TIMEOUT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  DB_HEALTH_CHECK_RETRIES: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),

  // Migration settings
  DB_MIGRATION_TABLE: z.string().optional(),
  DB_MIGRATIONS_PATH: z.string().optional(),

  // Performance monitoring
  DB_ENABLE_POOL_MONITORING: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  DB_POOL_MONITORING_INTERVAL: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),

  // Environment
  NODE_ENV: z
    .nativeEnum(DatabaseEnvironment)
    .optional()
    .default(DatabaseEnvironment.DEVELOPMENT),
});

export type DatabaseEnvironmentVariables = z.infer<
  typeof DatabaseEnvironmentVariablesSchema
>;

/**
 * Core database connection configuration
 */
export interface DatabaseConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly database: string;
  readonly ssl?: DatabaseSslConfig;
}

/**
 * SSL configuration for database connections
 */
export interface DatabaseSslConfig {
  readonly enabled: boolean;
  readonly mode?: DatabaseSslMode;
  readonly rejectUnauthorized?: boolean;
  readonly ca?: string;
  readonly cert?: string;
  readonly key?: string;
}

/**
 * Database connection pool configuration
 */
export interface DatabasePoolConfig {
  readonly maximumPoolSize: number;
  readonly minimumPoolSize: number;
  readonly acquireTimeoutMillis: number;
  readonly createTimeoutMillis: number;
  readonly destroyTimeoutMillis: number;
  readonly idleTimeoutMillis: number;
  readonly reapIntervalMillis: number;
  readonly createRetryIntervalMillis: number;
}

/**
 * Database timeout configuration
 */
export interface DatabaseTimeoutConfig {
  readonly connectionTimeoutMillis: number;
  readonly statementTimeoutMillis: number;
  readonly queryTimeoutMillis: number;
}

/**
 * Database health check configuration
 */
export interface DatabaseHealthCheckConfig {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly testQuery: string;
  readonly validateOnBorrow: boolean;
  readonly validateOnReturn: boolean;
  readonly validatePeriodically: boolean;
  readonly validationIntervalMs: number;
}

/**
 * Database logging configuration
 */
export interface DatabaseLoggingConfig {
  readonly level: DatabaseLogLevel;
  readonly enableQueryLogging: boolean;
  readonly enableSlowQueryLogging: boolean;
  readonly slowQueryThresholdMs: number;
  readonly enableErrorLogging: boolean;
  readonly enablePerformanceLogging: boolean;
}

/**
 * Database migration configuration
 */
export interface DatabaseMigrationConfig {
  readonly tableName: string;
  readonly migrationsPath: string;
  readonly enableAutoMigration: boolean;
  readonly validateChecksums: boolean;
}

/**
 * Database performance monitoring configuration
 */
export interface DatabaseMonitoringConfig {
  readonly enabled: boolean;
  readonly poolMonitoringIntervalMs: number;
  readonly metricsCollectionEnabled: boolean;
  readonly performanceTrackingEnabled: boolean;
  readonly connectionLeakDetectionEnabled: boolean;
  readonly connectionLeakThresholdMs: number;
}

/**
 * Database retry and resilience configuration
 */
export interface DatabaseResilienceConfig {
  readonly maxConnectionRetries: number;
  readonly connectionRetryDelayMs: number;
  readonly connectionRetryBackoffMultiplier: number;
  readonly enableCircuitBreaker: boolean;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerRecoveryTimeoutMs: number;
}

/**
 * Complete database configuration combining all aspects
 */
export interface DatabaseConfiguration {
  readonly environment: DatabaseEnvironment;
  readonly connection: DatabaseConnectionConfig;
  readonly pool: DatabasePoolConfig;
  readonly timeouts: DatabaseTimeoutConfig;
  readonly healthCheck: DatabaseHealthCheckConfig;
  readonly logging: DatabaseLoggingConfig;
  readonly migration: DatabaseMigrationConfig;
  readonly monitoring: DatabaseMonitoringConfig;
  readonly resilience: DatabaseResilienceConfig;
}

/**
 * Configuration validation constraints
 */
export interface DatabaseConfigConstraints {
  readonly minPoolSize: number;
  readonly maxPoolSize: number;
  readonly minTimeoutMs: number;
  readonly maxTimeoutMs: number;
  readonly minHealthCheckInterval: number;
  readonly maxHealthCheckInterval: number;
  readonly minPort: number;
  readonly maxPort: number;
}

/**
 * Default configuration constraints
 */
export const DEFAULT_DATABASE_CONFIG_CONSTRAINTS: DatabaseConfigConstraints = {
  minPoolSize: 1,
  maxPoolSize: 100,
  minTimeoutMs: 1000,
  maxTimeoutMs: 300000, // 5 minutes
  minHealthCheckInterval: 5000,
  maxHealthCheckInterval: 300000, // 5 minutes
  minPort: 1,
  maxPort: 65535,
} as const;

/**
 * Configuration builder result with validation metadata
 */
export interface DatabaseConfigurationResult {
  readonly config: DatabaseConfiguration;
  readonly warnings: string[];
  readonly environment: DatabaseEnvironment;
  readonly source: 'environment' | 'profile' | 'default';
}

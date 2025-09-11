import { ModuleMetadata, Type } from '@nestjs/common';
import { ClientConfiguration } from 'slonik';

/**
 * Database module configuration options
 */
export interface DatabaseModuleOptions {
  /** Database connection URI */
  connectionUri?: string;

  /** Individual connection parameters */
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;

  /** SSL configuration */
  ssl?: boolean;
  sslRejectUnauthorized?: boolean;

  /** Connection pool configuration */
  maximumPoolSize?: number;
  minimumPoolSize?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;

  /** Connection timeout settings */
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
  queryTimeoutMillis?: number;

  /** Health check configuration */
  healthCheckIntervalMs?: number;

  /** Migration configuration */
  migrationTableName?: string;
  migrationsPath?: string;

  /** Logging configuration */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableQueryLogging?: boolean;

  /** Additional Slonik client configuration */
  clientConfiguration?: Partial<ClientConfiguration>;
}

/**
 * Factory interface for creating database module options
 */
export interface DatabaseOptionsFactory {
  createDatabaseOptions():
    | Promise<DatabaseModuleOptions>
    | DatabaseModuleOptions;
}

/**
 * Async configuration options for database module
 */
export interface DatabaseModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  /** Use existing provider */
  useExisting?: Type<DatabaseOptionsFactory>;

  /** Use class to create options */
  useClass?: Type<DatabaseOptionsFactory>;

  /** Use factory function to create options */
  useFactory?: (
    ...args: any[]
  ) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;

  /** Dependencies to inject into factory */
  inject?: any[];
}

/**
 * Database connection health status
 */
export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
  details?: {
    poolSize?: number;
    activeConnections?: number;
    idleConnections?: number;
    pendingRequests?: number;
  };
}

/**
 * Database migration status
 */
export interface MigrationStatus {
  name: string;
  executed: boolean;
  executedAt?: Date;
  checksum?: string;
}

/**
 * Database transaction options
 */
export interface TransactionOptions {
  /** Transaction isolation level */
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';

  /** Transaction timeout in milliseconds */
  timeout?: number;

  /** Whether to rollback on any error */
  rollbackOnError?: boolean;
}

/**
 * Database query execution context
 */
export interface QueryContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  timestamp: Date;
}

/**
 * Database connection pool statistics
 */
export interface PoolStatistics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  maximumPoolSize: number;
  minimumPoolSize: number;
}

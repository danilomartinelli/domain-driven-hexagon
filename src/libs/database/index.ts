/**
 * Database module exports
 * Provides a centralized export for all database-related functionality
 */

// Main module
export { DatabaseModule } from './database.module';

// Services
export { DatabaseService } from './database.service';
export { DatabaseConfigService } from './database-config.service';
export { DatabaseMigrationService } from './database-migration.service';
export { DatabaseConnectionFactory } from './database-connection.factory';

// Enhanced services and configuration

// Constants and tokens
export {
  DATABASE_POOL_TOKEN,
  DATABASE_CONFIG_TOKEN,
  DATABASE_MODULE_OPTIONS_TOKEN,
  DEFAULT_DATABASE_CONFIG,
  DATABASE_CONFIG_PROFILES,
  DATABASE_ENV_VARS,
  CONNECTION_VALIDATION,
  DATABASE_CONFIG_LIMITS,
} from './database.constants';

// Interfaces and types
export type {
  DatabaseModuleOptions,
  DatabaseModuleAsyncOptions,
  DatabaseOptionsFactory,
  DatabaseHealthStatus,
  MigrationStatus,
  TransactionOptions,
  QueryContext,
  PoolStatistics,
} from './database.interfaces';

// CLI tools
export { MigrationCLI } from './cli/migration.cli';

// Re-export commonly used Slonik types for convenience
export type {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  SqlToken,
  // ValueExpressionToken, // Not available in v48, use ValueExpression instead
  IdentifierSqlToken,
} from 'slonik';

export { sql } from 'slonik';

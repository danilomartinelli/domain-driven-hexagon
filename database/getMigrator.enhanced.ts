import { createPool, DatabasePool } from 'slonik';
import { DatabaseMigrationService } from '../src/libs/database/database-migration.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createHash } from 'crypto';

// Enhanced environment variable validation with branded types
type DatabaseEnvVar = string & { readonly __brand: 'DatabaseEnvVar' };
type DatabasePort = number & { readonly __brand: 'DatabasePort' };

interface RequiredDatabaseEnv {
  readonly DB_USERNAME: DatabaseEnvVar;
  readonly DB_PASSWORD: DatabaseEnvVar;
  readonly DB_HOST: DatabaseEnvVar;
  readonly DB_NAME: DatabaseEnvVar;
}

interface MigratorConfigService {
  readonly config: {
    readonly migrationsPath: string;
    readonly migrationTableName: string;
  };
}

interface MigratorResult {
  readonly pool: DatabasePool;
  readonly migrator: DatabaseMigrationService;
}

class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly connectionDetails?: Partial<RequiredDatabaseEnv>
  ) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

// Environment validation with Result pattern
type ValidationResult<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

function validateEnvironmentVariables(): ValidationResult<RequiredDatabaseEnv, string[]> {
  const errors: string[] = [];
  const requiredVars = ['DB_USERNAME', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'] as const;

  const env: Partial<RequiredDatabaseEnv> = {};

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${varName}`);
    } else {
      (env as any)[varName] = value as DatabaseEnvVar;
    }
  }

  return errors.length > 0
    ? { success: false, error: errors }
    : { success: true, data: env as RequiredDatabaseEnv };
}

function createSecureConnectionString(env: RequiredDatabaseEnv): string {
  // URL encode credentials to handle special characters safely
  const encodedUsername = encodeURIComponent(env.DB_USERNAME);
  const encodedPassword = encodeURIComponent(env.DB_PASSWORD);
  const encodedDatabase = encodeURIComponent(env.DB_NAME);

  return `postgres://${encodedUsername}:${encodedPassword}@${env.DB_HOST}/${encodedDatabase}`;
}

export async function getMigrator(): Promise<MigratorResult> {
  // Load environment configuration
  const envPath = path.resolve(
    __dirname,
    process.env.NODE_ENV === 'test' ? '../.env.test' : '../.env',
  );
  dotenv.config({ path: envPath });

  // Validate environment variables
  const envValidation = validateEnvironmentVariables();
  if (!envValidation.success) {
    throw new DatabaseConnectionError(
      `Environment validation failed: ${envValidation.error.join(', ')}`
    );
  }

  try {
    // Create database pool with enhanced error handling and optimized settings
    const connectionString = createSecureConnectionString(envValidation.data);
    const pool = await createPool(connectionString, {
      // Optimized connection pool configuration
      maximumPoolSize: process.env.NODE_ENV === 'production' ? 25 : 10,
      minimumPoolSize: process.env.NODE_ENV === 'production' ? 5 : 2,
      connectionTimeout: 'DISABLE_TIMEOUT',
      idleTimeout: 60000, // 1 minute
      maximumPoolSizePerHost: process.env.NODE_ENV === 'production' ? 25 : 10,
      // Enhanced query timing
      queryTimeout: process.env.NODE_ENV === 'test' ? 5000 : 30000,
    });

    // Type-safe config service implementation
    const configService: MigratorConfigService = {
      config: {
        migrationsPath: path.resolve(__dirname, 'migrations'),
        migrationTableName: 'migration',
      },
    } as const;

    const migrator = new DatabaseMigrationService(pool, configService);

    return { pool, migrator };
  } catch (error) {
    throw new DatabaseConnectionError(
      'Failed to initialize database migrator',
      error instanceof Error ? error : new Error(String(error)),
      // Don't include sensitive connection details in error
      {
        DB_HOST: envValidation.data.DB_HOST,
        DB_NAME: envValidation.data.DB_NAME,
        // Omit credentials from error details
      } as Partial<RequiredDatabaseEnv>
    );
  }
}

// Enhanced legacy export with deprecation warning
/** @deprecated Use getMigrator() instead */
export const SlonikMigrator = DatabaseMigrationService;
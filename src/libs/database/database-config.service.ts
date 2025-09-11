import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { get } from 'env-var';
import { z } from 'zod';
import {
  DATABASE_MODULE_OPTIONS_TOKEN,
  DEFAULT_DATABASE_CONFIG,
  DATABASE_ENV_VARS,
} from './database.constants';
import { DatabaseModuleOptions } from './database.interfaces';

/**
 * Zod schema for database configuration validation
 */
const DatabaseConfigSchema = z.object({
  host: z.string().min(1, 'Database host is required'),
  port: z.number().int().min(1).max(65535, 'Invalid database port'),
  username: z.string().min(1, 'Database username is required'),
  password: z.string().min(1, 'Database password is required'),
  database: z.string().min(1, 'Database name is required'),

  ssl: z.boolean().default(false),
  sslRejectUnauthorized: z.boolean().default(true),

  maximumPoolSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(DEFAULT_DATABASE_CONFIG.maximumPoolSize),
  minimumPoolSize: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(DEFAULT_DATABASE_CONFIG.minimumPoolSize),
  acquireTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.acquireTimeoutMillis),
  createTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.createTimeoutMillis),
  destroyTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.destroyTimeoutMillis),
  idleTimeoutMillis: z
    .number()
    .int()
    .min(10000)
    .default(DEFAULT_DATABASE_CONFIG.idleTimeoutMillis),
  reapIntervalMillis: z
    .number()
    .int()
    .min(100)
    .default(DEFAULT_DATABASE_CONFIG.reapIntervalMillis),
  createRetryIntervalMillis: z
    .number()
    .int()
    .min(50)
    .default(DEFAULT_DATABASE_CONFIG.createRetryIntervalMillis),

  connectionTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.connectionTimeoutMillis),
  statementTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.statementTimeoutMillis),
  queryTimeoutMillis: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.queryTimeoutMillis),

  healthCheckIntervalMs: z
    .number()
    .int()
    .min(1000)
    .default(DEFAULT_DATABASE_CONFIG.healthCheckIntervalMs),

  migrationTableName: z
    .string()
    .min(1)
    .default(DEFAULT_DATABASE_CONFIG.migrationTableName),
  migrationsPath: z
    .string()
    .min(1)
    .default(DEFAULT_DATABASE_CONFIG.migrationsPath),

  logLevel: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default(DEFAULT_DATABASE_CONFIG.logLevel),
  enableQueryLogging: z
    .boolean()
    .default(DEFAULT_DATABASE_CONFIG.enableQueryLogging),
});

export type ValidatedDatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Service for managing database configuration with validation and type safety.
 * Handles environment variable loading, validation, and provides type-safe access to config values.
 */
@Injectable()
export class DatabaseConfigService implements OnModuleInit {
  private _config: ValidatedDatabaseConfig | null = null;
  private _connectionUri: string | null = null;

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS_TOKEN)
    private readonly options: DatabaseModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    this._config = await this.validateAndParseConfig();
    this._connectionUri = this.buildConnectionUri();
  }

  /**
   * Get the validated database configuration
   */
  get config(): ValidatedDatabaseConfig {
    if (!this._config) {
      throw new Error(
        'Database configuration not initialized. Call onModuleInit() first.',
      );
    }
    return this._config;
  }

  /**
   * Get the database connection URI
   */
  get connectionUri(): string {
    if (!this._connectionUri) {
      throw new Error(
        'Database connection URI not initialized. Call onModuleInit() first.',
      );
    }
    return this._connectionUri;
  }

  /**
   * Check if the configuration is for a production environment
   */
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Check if the configuration is for a test environment
   */
  get isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * Get SSL configuration object for Slonik
   */
  get sslConfig(): boolean | object {
    if (!this.config.ssl) {
      return false;
    }

    return {
      rejectUnauthorized: this.config.sslRejectUnauthorized,
    };
  }

  /**
   * Get connection pool configuration for Slonik
   */
  get poolConfig(): {
    maximumPoolSize: number;
    minimumPoolSize: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  } {
    return {
      maximumPoolSize: this.config.maximumPoolSize,
      minimumPoolSize: this.config.minimumPoolSize,
      acquireTimeoutMillis: this.config.acquireTimeoutMillis,
      createTimeoutMillis: this.config.createTimeoutMillis,
      destroyTimeoutMillis: this.config.destroyTimeoutMillis,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      reapIntervalMillis: this.config.reapIntervalMillis,
      createRetryIntervalMillis: this.config.createRetryIntervalMillis,
    };
  }

  /**
   * Get timeout configuration for database operations
   */
  get timeoutConfig(): {
    connectionTimeoutMillis: number;
    statementTimeoutMillis: number;
    queryTimeoutMillis: number;
  } {
    return {
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      statementTimeoutMillis: this.config.statementTimeoutMillis,
      queryTimeoutMillis: this.config.queryTimeoutMillis,
    };
  }

  /**
   * Validate and parse database configuration from environment variables and options
   */
  private async validateAndParseConfig(): Promise<ValidatedDatabaseConfig> {
    try {
      // Merge environment variables with provided options
      const rawConfig = {
        // From environment variables (with defaults from options)
        host:
          this.options.host ??
          get(DATABASE_ENV_VARS.HOST).required().asString(),
        port:
          this.options.port ??
          get(DATABASE_ENV_VARS.PORT).required().asIntPositive(),
        username:
          this.options.username ??
          get(DATABASE_ENV_VARS.USERNAME).required().asString(),
        password:
          this.options.password ??
          get(DATABASE_ENV_VARS.PASSWORD).required().asString(),
        database:
          this.options.database ??
          get(DATABASE_ENV_VARS.DATABASE).required().asString(),

        ssl:
          this.options.ssl ??
          get(DATABASE_ENV_VARS.SSL).default('false').asBool(),
        sslRejectUnauthorized:
          this.options.sslRejectUnauthorized ??
          get(DATABASE_ENV_VARS.SSL_REJECT_UNAUTHORIZED)
            .default('true')
            .asBool(),

        // Pool configuration
        maximumPoolSize:
          this.options.maximumPoolSize ??
          get(DATABASE_ENV_VARS.MAX_POOL_SIZE)
            .default(DEFAULT_DATABASE_CONFIG.maximumPoolSize)
            .asIntPositive(),
        minimumPoolSize:
          this.options.minimumPoolSize ??
          get(DATABASE_ENV_VARS.MIN_POOL_SIZE)
            .default(DEFAULT_DATABASE_CONFIG.minimumPoolSize)
            .asInt(),

        // Timeout configuration
        connectionTimeoutMillis:
          this.options.connectionTimeoutMillis ??
          get(DATABASE_ENV_VARS.CONNECTION_TIMEOUT)
            .default(DEFAULT_DATABASE_CONFIG.connectionTimeoutMillis)
            .asIntPositive(),
        statementTimeoutMillis:
          this.options.statementTimeoutMillis ??
          get(DATABASE_ENV_VARS.STATEMENT_TIMEOUT)
            .default(DEFAULT_DATABASE_CONFIG.statementTimeoutMillis)
            .asIntPositive(),
        queryTimeoutMillis:
          this.options.queryTimeoutMillis ??
          get(DATABASE_ENV_VARS.QUERY_TIMEOUT)
            .default(DEFAULT_DATABASE_CONFIG.queryTimeoutMillis)
            .asIntPositive(),

        // Other configuration
        logLevel:
          this.options.logLevel ??
          get(DATABASE_ENV_VARS.LOG_LEVEL)
            .default(DEFAULT_DATABASE_CONFIG.logLevel)
            .asString(),
        enableQueryLogging:
          this.options.enableQueryLogging ??
          get(DATABASE_ENV_VARS.ENABLE_QUERY_LOGGING)
            .default(DEFAULT_DATABASE_CONFIG.enableQueryLogging.toString())
            .asBool(),

        // Use defaults for other fields not commonly set via env vars
        acquireTimeoutMillis:
          this.options.acquireTimeoutMillis ??
          DEFAULT_DATABASE_CONFIG.acquireTimeoutMillis,
        createTimeoutMillis:
          this.options.createTimeoutMillis ??
          DEFAULT_DATABASE_CONFIG.createTimeoutMillis,
        destroyTimeoutMillis:
          this.options.destroyTimeoutMillis ??
          DEFAULT_DATABASE_CONFIG.destroyTimeoutMillis,
        idleTimeoutMillis:
          this.options.idleTimeoutMillis ??
          DEFAULT_DATABASE_CONFIG.idleTimeoutMillis,
        reapIntervalMillis:
          this.options.reapIntervalMillis ??
          DEFAULT_DATABASE_CONFIG.reapIntervalMillis,
        createRetryIntervalMillis:
          this.options.createRetryIntervalMillis ??
          DEFAULT_DATABASE_CONFIG.createRetryIntervalMillis,
        healthCheckIntervalMs:
          this.options.healthCheckIntervalMs ??
          DEFAULT_DATABASE_CONFIG.healthCheckIntervalMs,
        migrationTableName:
          this.options.migrationTableName ??
          DEFAULT_DATABASE_CONFIG.migrationTableName,
        migrationsPath:
          this.options.migrationsPath ?? DEFAULT_DATABASE_CONFIG.migrationsPath,
      };

      // Validate configuration using Zod schema
      const validatedConfig = DatabaseConfigSchema.parse(rawConfig);

      // Additional validation logic
      this.validatePoolConfiguration(validatedConfig);
      this.validateTimeoutConfiguration(validatedConfig);

      return validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        throw new Error(
          `Database configuration validation failed:\n${errorMessages.join('\n')}`,
        );
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to load database configuration: ${errorMessage}`,
      );
    }
  }

  /**
   * Validate pool configuration constraints
   */
  private validatePoolConfiguration(config: ValidatedDatabaseConfig): void {
    if (config.minimumPoolSize > config.maximumPoolSize) {
      throw new Error('minimumPoolSize cannot be greater than maximumPoolSize');
    }

    // Warn about potentially problematic configurations
    if (config.maximumPoolSize > 50 && !this.isProduction) {
      console.warn(
        'Warning: Large pool size detected in non-production environment',
      );
    }
  }

  /**
   * Validate timeout configuration constraints
   */
  private validateTimeoutConfiguration(config: ValidatedDatabaseConfig): void {
    if (config.statementTimeoutMillis < config.connectionTimeoutMillis) {
      console.warn(
        'Warning: Statement timeout is less than connection timeout',
      );
    }

    if (config.queryTimeoutMillis > config.statementTimeoutMillis) {
      console.warn('Warning: Query timeout is greater than statement timeout');
    }
  }

  /**
   * Build PostgreSQL connection URI from configuration
   */
  private buildConnectionUri(): string {
    if (this.options.connectionUri) {
      return this.options.connectionUri;
    }

    const config = this.config;
    const auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`;
    const host = config.host;
    const port = config.port;
    const database = config.database;

    let uri = `postgres://${auth}@${host}:${port}/${database}`;

    // Add SSL parameter if needed
    if (config.ssl) {
      uri += '?sslmode=require';
      if (!config.sslRejectUnauthorized) {
        uri += '&sslcert=disable';
      }
    }

    return uri;
  }
}

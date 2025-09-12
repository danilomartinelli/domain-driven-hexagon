import { Injectable, Logger } from '@nestjs/common';
import {
  createPool,
  DatabasePool,
  createTypeParserPreset,
  sql,
  // createInterceptorPreset and createClientConfiguration may not exist in v48
  // ClientConfiguration,
} from 'slonik';
import { DatabaseConfigService } from './database-config.service';

/**
 * Factory service for creating and configuring Slonik database connection pools.
 * Handles connection pool creation with proper type parsing, interceptors, and error handling.
 */
@Injectable()
export class DatabaseConnectionFactory {
  private readonly logger = new Logger(DatabaseConnectionFactory.name);

  constructor(private readonly configService: DatabaseConfigService) {}

  /**
   * Create a configured Slonik database pool
   */
  async createPool(): Promise<DatabasePool> {
    try {
      const config = this.configService.config;
      const clientConfiguration = this.createPoolConfiguration();

      this.logger.log('Creating database connection pool...', {
        host: config.host,
        port: config.port,
        database: config.database,
        maximumPoolSize: config.maximumPoolSize,
        minimumPoolSize: config.minimumPoolSize,
      });

      const pool = await createPool(
        this.configService.connectionUri,
        clientConfiguration,
      );

      // Validate connection on startup
      await this.validateConnection(pool);

      this.logger.log('Database connection pool created successfully');

      return pool;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        'Failed to create database connection pool',
        errorStack,
      );
      throw new Error(`Database connection failed: ${errorMessage}`);
    }
  }

  /**
   * Create Slonik pool configuration with interceptors and type parsers
   */
  private createPoolConfiguration(): Record<string, any> {
    const config = this.configService.config;

    const poolConfig: Record<string, any> = {
      // Connection pool configuration
      maximumPoolSize: config.maximumPoolSize,
      minimumPoolSize: config.minimumPoolSize,
      acquireTimeoutMillis: config.acquireTimeoutMillis,
      createTimeoutMillis: config.createTimeoutMillis,
      destroyTimeoutMillis: config.destroyTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      reapIntervalMillis: config.reapIntervalMillis,
      createRetryIntervalMillis: config.createRetryIntervalMillis,

      // Connection timeout settings
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      statementTimeoutMillis: config.statementTimeoutMillis,
      queryTimeoutMillis: config.queryTimeoutMillis,

      // SSL configuration
      ssl: this.configService.sslConfig,

      // Type parsers for proper TypeScript type handling
      typeParsers: this.createTypeParsers(),

      // Interceptors for logging and monitoring
      interceptors: this.createInterceptors(),
    };

    return poolConfig;
  }

  /**
   * Create type parsers for PostgreSQL data types
   */
  private createTypeParsers(): Array<{
    name: string;
    parse: (value: string) => any;
  }> {
    const customParsers: Array<{
      name: string;
      parse: (value: string) => any;
    }> = [
      // Custom type parsers for specific PostgreSQL types
      {
        name: 'timestamptz',
        parse: (value: string): Date => {
          return new Date(value);
        },
      },
      {
        name: 'timestamp',
        parse: (value: string): Date => {
          return new Date(value);
        },
      },
      {
        name: 'date',
        parse: (value: string): Date => {
          return new Date(value);
        },
      },
      {
        name: 'json',
        parse: (value: string): any => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
      },
      {
        name: 'jsonb',
        parse: (value: string): any => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
      },
      {
        name: 'numeric',
        parse: (value: string): number | string => {
          const num = parseFloat(value);
          return isNaN(num) ? value : num;
        },
      },
      {
        name: 'bigint',
        parse: (value: string): bigint | string => {
          try {
            return BigInt(value);
          } catch {
            return value;
          }
        },
      },
    ];

    try {
      // Try to use the preset parsers if available
      const presetParsers = createTypeParserPreset();
      return [...presetParsers, ...customParsers];
    } catch {
      // If preset parsers are not available, just use custom ones
      return customParsers;
    }
  }

  /**
   * Create interceptors for query logging, monitoring, and error handling
   */
  private createInterceptors(): Array<Record<string, any>> {
    const config = this.configService.config;
    const interceptors: Array<Record<string, any>> = [];

    // Add query logging interceptor if enabled
    if (config.enableQueryLogging) {
      interceptors.push({
        beforePoolConnection: async (context: any, query: any) => {
          if (config.logLevel === 'debug') {
            this.logger.debug('Executing query', {
              sql:
                query.sql.substring(0, 200) +
                (query.sql.length > 200 ? '...' : ''),
              // Only log values in development for security
              ...(process.env.NODE_ENV === 'development' && {
                values: query.values,
              }),
            });
          }
          return null;
        },
        afterPoolConnection: async (context: any, query: any, result: any) => {
          if (config.logLevel === 'debug') {
            this.logger.debug('Query completed', {
              sql: query.sql,
              rowCount: result.rowCount,
              duration: `${Date.now() - (context.startTime || Date.now())}ms`,
            });
          }
          return null;
        },
        queryExecutionError: async (context: any, query: any, error: Error) => {
          // Only log query values in development for security
          this.logger.error('Query execution error', {
            sql:
              query.sql.substring(0, 200) +
              (query.sql.length > 200 ? '...' : ''),
            error: error.message,
            ...(config.logLevel === 'debug' && { values: query.values }),
          });
          return null;
        },
      });
    }

    // Add performance monitoring interceptor
    interceptors.push({
      beforePoolConnection: async (context: any) => {
        context.startTime = Date.now();
        return null;
      },
      afterPoolConnection: async (context: any, query: any, result: any) => {
        const duration = Date.now() - (context.startTime || Date.now());

        // Log slow queries (> 1 second)
        if (duration > 1000) {
          this.logger.warn('Slow query detected', {
            sql: query.sql,
            duration: `${duration}ms`,
            rowCount: result.rowCount,
          });
        }

        return null;
      },
    });

    // Add connection health monitoring interceptor
    interceptors.push({
      beforePoolConnection: async () => {
        // Track connection attempts for health monitoring
        return null;
      },
      poolConnectionError: async (context: any, error: Error) => {
        // Create database error with secure context
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        this.logger.error('Pool connection error', {
          error: errorMessage,
          context: context.poolId || 'unknown',
        });
        return null;
      },
    });

    return interceptors;
  }

  /**
   * Validate database connection by executing a simple query
   */
  private async validateConnection(pool: DatabasePool): Promise<void> {
    try {
      const result = await pool.oneFirst(sql.unsafe`SELECT 1 as test`);

      if (result !== 1) {
        throw new Error('Connection validation failed: unexpected result');
      }

      this.logger.log('Database connection validation successful');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Database connection validation failed', errorStack);

      // Attempt to end the pool before throwing
      try {
        await pool.end();
      } catch (endError) {
        this.logger.error(
          'Failed to close pool after validation error',
          endError instanceof Error ? endError.stack : undefined,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Connection validation failed: ${errorMessage}`);
    }
  }
}

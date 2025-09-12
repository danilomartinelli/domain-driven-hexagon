import {
  Injectable,
  Inject,
  OnModuleDestroy,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  sql,
} from 'slonik';
import { DATABASE_POOL_TOKEN } from './database.constants';
import {
  DatabaseHealthStatus,
  PoolStatistics,
  TransactionOptions,
  QueryContext,
} from './database.interfaces';
import { DatabaseConfigService } from './database-config.service';

/**
 * Central database service that provides high-level database operations,
 * health monitoring, and transaction management.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck?: DatabaseHealthStatus;
  private _cachedPoolStats: {
    stats: PoolStatistics;
    timestamp: number;
  } | null = null;
  private readonly STATS_CACHE_TTL_MS = 5000; // Cache for 5 seconds

  constructor(
    @Inject(DATABASE_POOL_TOKEN)
    private readonly pool: DatabasePool,
    private readonly configService: DatabaseConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeHealthChecks();
    this.logger.log('Database service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
    this.logger.log('Database service destroyed');
  }

  /**
   * Get the database pool instance
   */
  getPool(): DatabasePool {
    return this.pool;
  }

  /**
   * Execute a query with optional context information
   */
  async query<T = any>(
    query: Parameters<DatabasePool['query']>[0],
    context?: QueryContext,
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      if (context && this.configService.config.enableQueryLogging) {
        this.logger.debug('Executing query', {
          requestId: context.requestId,
          userId: context.userId,
          operation: context.operation,
        });
      }

      const result = await this.pool.query(query);

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        this.logger.warn('Slow query detected', {
          duration: `${duration}ms`,
          rowCount: result.rowCount,
          requestId: context?.requestId,
        });
      }

      return result as QueryResult<T>;
    } catch (error) {
      this.logger.error('Query execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: context?.requestId,
        operation: context?.operation,
      });
      throw error;
    }
  }

  /**
   * Execute a transaction with optional configuration
   */
  async transaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting transaction', {
        isolationLevel: options?.isolationLevel,
        timeout: options?.timeout,
      });

      // Set transaction configuration if provided
      const transactionHandler = async (
        connection: DatabaseTransactionConnection,
      ) => {
        // Set isolation level if specified
        if (options?.isolationLevel) {
          await connection.query(
            sql.unsafe`SET TRANSACTION ISOLATION LEVEL ${sql.identifier([options.isolationLevel])}`,
          );
        }

        // Set timeout if specified
        if (options?.timeout) {
          await connection.query(
            sql.unsafe`SET statement_timeout = ${options.timeout}`,
          );
        }

        return handler(connection);
      };

      const result = await this.pool.transaction(transactionHandler);

      const duration = Date.now() - startTime;
      this.logger.debug('Transaction completed', {
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Transaction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        isolationLevel: options?.isolationLevel,
      });

      if (options?.rollbackOnError !== false) {
        // Rollback is handled automatically by Slonik
        this.logger.debug('Transaction rolled back');
      }

      throw error;
    }
  }

  /**
   * Get current database health status
   */
  async getHealthStatus(forceCheck = false): Promise<DatabaseHealthStatus> {
    if (!forceCheck && this.lastHealthCheck) {
      const timeSinceLastCheck =
        Date.now() - this.lastHealthCheck.lastChecked.getTime();
      if (
        timeSinceLastCheck < this.configService.config.healthCheckIntervalMs
      ) {
        return this.lastHealthCheck;
      }
    }

    const startTime = Date.now();

    try {
      // Execute a simple query to check connection
      await this.pool.oneFirst(sql.unsafe`SELECT 1`);

      const responseTime = Date.now() - startTime;
      const poolStats = await this.getPoolStatistics();

      this.lastHealthCheck = {
        status: 'healthy',
        lastChecked: new Date(),
        responseTime,
        details: {
          poolSize: poolStats.totalConnections,
          activeConnections: poolStats.activeConnections,
          idleConnections: poolStats.idleConnections,
          pendingRequests: poolStats.pendingRequests,
        },
      };

      return this.lastHealthCheck;
    } catch (error) {
      this.logger.error(
        'Health check failed',
        error instanceof Error ? error.stack : undefined,
      );

      this.lastHealthCheck = {
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return this.lastHealthCheck;
    }
  }

  /**
   * Get connection pool statistics with caching for better performance
   */
  async getPoolStatistics(forceRefresh = false): Promise<PoolStatistics> {
    // Check cache first unless force refresh is requested
    if (!forceRefresh && this._cachedPoolStats) {
      const timeSinceCache = Date.now() - this._cachedPoolStats.timestamp;
      if (timeSinceCache < this.STATS_CACHE_TTL_MS) {
        return this._cachedPoolStats.stats;
      }
    }

    // Note: Slonik doesn't expose internal pool statistics directly
    // This is a simplified implementation that would need to be enhanced
    // based on the actual pool implementation details

    try {
      // Query pg_stat_activity for connection information
      const result = await this.pool.many(sql.unsafe`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      const stats = result[0] as any;
      const config = this.configService.config;

      const poolStats: PoolStatistics = {
        totalConnections: Number(stats.total_connections) || 0,
        activeConnections: Number(stats.active_connections) || 0,
        idleConnections: Number(stats.idle_connections) || 0,
        pendingRequests: 0, // Would need pool internals to get this
        maximumPoolSize: config.maximumPoolSize,
        minimumPoolSize: config.minimumPoolSize,
      };

      // Cache the results
      this._cachedPoolStats = {
        stats: poolStats,
        timestamp: Date.now(),
      };

      return poolStats;
    } catch (error) {
      this.logger.warn(
        'Failed to get pool statistics',
        error instanceof Error ? error.message : 'Unknown error',
      );

      const config = this.configService.config;
      const fallbackStats: PoolStatistics = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        pendingRequests: 0,
        maximumPoolSize: config.maximumPoolSize,
        minimumPoolSize: config.minimumPoolSize,
      };

      // Don't cache error results
      return fallbackStats;
    }
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.pool.oneFirst(sql.unsafe`SELECT 1`);
      return true;
    } catch (error) {
      this.logger.error(
        'Connection test failed',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Get database version information
   */
  async getDatabaseVersion(): Promise<string> {
    try {
      const version = await this.pool.oneFirst(sql.unsafe`SELECT version()`);
      return version as string;
    } catch (error) {
      this.logger.error(
        'Failed to get database version',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Initialize health check monitoring
   */
  private async initializeHealthChecks(): Promise<void> {
    const intervalMs = this.configService.config.healthCheckIntervalMs;

    if (intervalMs > 0) {
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.getHealthStatus(true);
        } catch (error) {
          this.logger.error(
            'Periodic health check failed',
            error instanceof Error ? error.stack : undefined,
          );
        }
      }, intervalMs);

      this.logger.log(
        `Health check monitoring started (interval: ${intervalMs}ms)`,
      );
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Close database pool
    try {
      await this.pool.end();
      this.logger.log('Database pool closed successfully');
    } catch (error) {
      this.logger.error(
        'Failed to close database pool',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

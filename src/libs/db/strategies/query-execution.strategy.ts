import {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  SqlToken,
} from 'slonik';
import { LoggerPort } from '../../ports/logger.port';

/**
 * Strategy interface for query execution with different connection types
 */
export interface QueryExecutionStrategy {
  executeQuery<T = any>(
    query: SqlToken,
    operation: string,
  ): Promise<QueryResult<T>>;
  executeWriteQuery<T = any>(
    query: SqlToken,
    operation: string,
    entityIds?: string[],
  ): Promise<QueryResult<T>>;
}

/**
 * Pool-based query execution strategy for regular operations
 */
export class PoolQueryExecutionStrategy implements QueryExecutionStrategy {
  private static readonly SLOW_QUERY_THRESHOLD_MS = 1000;
  private static readonly QUERY_TIMEOUT_WARNING_MS = 5000;

  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
    private readonly tableName: string,
    private readonly getRequestId: () => string,
  ) {}

  async executeQuery<T = any>(
    query: SqlToken,
    operation: string,
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const requestId = this.getRequestId();

    this.logger.debug(
      `[${requestId}] Executing ${operation} on table "${this.tableName}"`,
    );

    try {
      const result = await this.pool.query(query as any);
      const duration = performance.now() - startTime;

      this.logQueryPerformance(
        requestId,
        operation,
        duration,
        result.rowCount || 0,
      );
      return result as QueryResult<T>;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.handleQueryError(requestId, operation, duration, error as Error);
      throw error;
    }
  }

  async executeWriteQuery<T = any>(
    query: SqlToken,
    operation: string,
    entityIds: string[] = [],
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const requestId = this.getRequestId();

    this.logger.debug(
      `[${requestId}] Executing ${operation} on table "${this.tableName}" for entities: ${entityIds.join(', ')}`,
    );

    try {
      const result = await this.pool.query(query as any);
      const duration = performance.now() - startTime;

      this.logWriteQueryResult(
        requestId,
        operation,
        duration,
        result.rowCount || 0,
        entityIds,
      );
      return result as QueryResult<T>;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.handleWriteQueryError(
        requestId,
        operation,
        duration,
        entityIds,
        error as Error,
      );
      throw error;
    }
  }

  private logQueryPerformance(
    requestId: string,
    operation: string,
    durationMs: number,
    affectedRows: number,
  ): void {
    if (durationMs > PoolQueryExecutionStrategy.SLOW_QUERY_THRESHOLD_MS) {
      this.logger.warn(
        `[${requestId}] Slow query detected: ${operation} took ${durationMs.toFixed(2)}ms`,
        {
          operation,
          table: this.tableName,
          duration: durationMs,
          affectedRows,
          severity:
            durationMs > PoolQueryExecutionStrategy.QUERY_TIMEOUT_WARNING_MS
              ? 'HIGH'
              : 'MEDIUM',
        },
      );
    } else {
      this.logger.debug(
        `[${requestId}] Query completed: ${operation} in ${durationMs.toFixed(2)}ms`,
        {
          affectedRows,
        },
      );
    }
  }

  private logWriteQueryResult(
    requestId: string,
    operation: string,
    durationMs: number,
    affectedRows: number,
    entityIds: string[],
  ): void {
    this.logger.debug(
      `[${requestId}] Write operation ${operation} completed in ${durationMs.toFixed(2)}ms`,
      {
        affectedRows,
        entityCount: entityIds.length,
        entities: entityIds.slice(0, 5), // Log first 5 IDs only
        hasMore: entityIds.length > 5,
      },
    );
  }

  private handleQueryError(
    requestId: string,
    operation: string,
    durationMs: number,
    error: Error,
  ): void {
    this.logger.error(
      `[${requestId}] Query ${operation} failed after ${durationMs.toFixed(2)}ms`,
      {
        error: error.message,
        table: this.tableName,
        errorType: error.constructor.name,
      },
    );
  }

  private handleWriteQueryError(
    requestId: string,
    operation: string,
    durationMs: number,
    entityIds: string[],
    error: Error,
  ): void {
    this.logger.error(
      `[${requestId}] Write operation ${operation} failed after ${durationMs.toFixed(2)}ms`,
      {
        error: error.message,
        table: this.tableName,
        entityCount: entityIds.length,
        errorType: error.constructor.name,
      },
    );
  }
}

/**
 * Transaction-based query execution strategy for transactional operations
 */
export class TransactionQueryExecutionStrategy
  implements QueryExecutionStrategy
{
  constructor(
    private readonly connection: DatabaseTransactionConnection,
    private readonly logger: LoggerPort,
    private readonly tableName: string,
    private readonly getRequestId: () => string,
  ) {}

  async executeQuery<T = any>(
    query: SqlToken,
    operation: string,
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const requestId = this.getRequestId();

    this.logger.debug(
      `[${requestId}] Executing transactional ${operation} on table "${this.tableName}"`,
    );

    try {
      const result = await this.connection.query(query as any);
      const duration = performance.now() - startTime;

      this.logger.debug(
        `[${requestId}] Transactional query ${operation} completed in ${duration.toFixed(2)}ms`,
        { affectedRows: result.rowCount || 0 },
      );

      return result as QueryResult<T>;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(
        `[${requestId}] Transactional query ${operation} failed after ${duration.toFixed(2)}ms`,
        {
          error: (error as Error).message,
          table: this.tableName,
          errorType: (error as Error).constructor.name,
        },
      );
      throw error;
    }
  }

  async executeWriteQuery<T = any>(
    query: SqlToken,
    operation: string,
    entityIds: string[] = [],
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const requestId = this.getRequestId();

    this.logger.debug(
      `[${requestId}] Executing transactional ${operation} on table "${this.tableName}" for entities: ${entityIds.join(', ')}`,
    );

    try {
      const result = await this.connection.query(query as any);
      const duration = performance.now() - startTime;

      this.logger.debug(
        `[${requestId}] Transactional write ${operation} completed in ${duration.toFixed(2)}ms`,
        {
          affectedRows: result.rowCount || 0,
          entityCount: entityIds.length,
        },
      );

      return result as QueryResult<T>;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(
        `[${requestId}] Transactional write ${operation} failed after ${duration.toFixed(2)}ms`,
        {
          error: (error as Error).message,
          table: this.tableName,
          entityCount: entityIds.length,
          errorType: (error as Error).constructor.name,
        },
      );
      throw error;
    }
  }
}

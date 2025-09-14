import { DatabasePool, DatabaseTransactionConnection, sql } from 'slonik';
import { LoggerPort } from '../../ports/logger.port';

/**
 * Transaction isolation levels supported by PostgreSQL
 */
export enum TransactionIsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

/**
 * Transaction configuration options
 */
export interface TransactionOptions {
  isolationLevel?: TransactionIsolationLevel;
  timeout?: number;
  readOnly?: boolean;
  deferrable?: boolean;
}

/**
 * Transaction execution result with performance metrics
 */
export interface TransactionResult<T> {
  result: T;
  duration: number;
  operationsCount: number;
}

/**
 * Strategy interface for managing database transactions
 */
export interface TransactionManagerStrategy {
  execute<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<TransactionResult<T>>;
}

/**
 * Advanced transaction manager with performance monitoring and retry logic
 */
export class AdvancedTransactionManagerStrategy
  implements TransactionManagerStrategy
{
  private static readonly DEFAULT_TIMEOUT_MS = 30000;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 100;
  private static readonly SERIALIZATION_FAILURE_CODES = ['40001', '40P01'];

  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
    private readonly getRequestId: () => string,
  ) {}

  async execute<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<T>> {
    const requestId = this.getRequestId();
    const startTime = performance.now();
    let operationsCount = 0;

    return this.executeWithRetry(async (attempt: number) => {
      return this.pool.transaction(async (connection) => {
        this.logger.debug(
          `[${requestId}] Transaction started (attempt ${attempt})`,
          {
            isolationLevel: options.isolationLevel,
            timeout: options.timeout,
            readOnly: options.readOnly,
          },
        );

        try {
          await this.configureTransaction(connection, options);

          const transactionConnection = this.createInstrumentedConnection(
            connection,
            () => {
              operationsCount++;
            },
          );

          const result = await handler(transactionConnection);
          const duration = performance.now() - startTime;

          this.logger.debug(
            `[${requestId}] Transaction committed successfully in ${duration.toFixed(2)}ms`,
            {
              operationsCount,
              attempt,
            },
          );

          return {
            result,
            duration,
            operationsCount,
          };
        } catch (error) {
          const duration = performance.now() - startTime;

          this.logger.error(
            `[${requestId}] Transaction failed and rolled back after ${duration.toFixed(2)}ms (attempt ${attempt})`,
            {
              error: (error as Error).message,
              errorType: (error as Error).constructor.name,
              operationsCount,
            },
          );

          throw error;
        }
      });
    });
  }

  private async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    maxAttempts: number = AdvancedTransactionManagerStrategy.MAX_RETRY_ATTEMPTS,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts || !this.isRetryableError(error as Error)) {
          throw error;
        }

        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn(
          `[${this.getRequestId()}] Transaction attempt ${attempt} failed, retrying in ${delay}ms`,
          {
            error: (error as Error).message,
            attempt,
            maxAttempts,
          },
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private async configureTransaction(
    connection: DatabaseTransactionConnection,
    options: TransactionOptions,
  ): Promise<void> {
    const configurations: string[] = [];

    if (options.isolationLevel) {
      configurations.push(`ISOLATION LEVEL ${options.isolationLevel}`);
    }

    if (options.readOnly) {
      configurations.push('READ ONLY');
    }

    if (
      options.deferrable &&
      options.isolationLevel === TransactionIsolationLevel.SERIALIZABLE
    ) {
      configurations.push('DEFERRABLE');
    }

    if (configurations.length > 0) {
      const configString = configurations.join(', ');
      await connection.query(
        sql.unsafe`SET TRANSACTION ${sql.unsafe`${configString}`}`,
      );
    }

    // Set statement timeout if specified
    const timeout =
      options.timeout ?? AdvancedTransactionManagerStrategy.DEFAULT_TIMEOUT_MS;
    await connection.query(sql.unsafe`SET statement_timeout = ${timeout}`);
  }

  private createInstrumentedConnection(
    connection: DatabaseTransactionConnection,
    onOperation: () => void,
  ): DatabaseTransactionConnection {
    return new Proxy(connection, {
      get(target, prop) {
        const originalMethod = target[prop as keyof typeof target];

        if (prop === 'query' && typeof originalMethod === 'function') {
          return (...args: any[]) => {
            onOperation();
            return originalMethod.apply(target, args);
          };
        }

        return originalMethod;
      },
    });
  }

  private isRetryableError(error: Error): boolean {
    // Check for serialization failures or deadlocks
    if ('code' in error) {
      const errorCode = (error as any).code;
      return AdvancedTransactionManagerStrategy.SERIALIZATION_FAILURE_CODES.includes(
        errorCode,
      );
    }

    // Check for connection-related errors
    const errorMessage = error.message.toLowerCase();
    const retryablePatterns = [
      'connection terminated',
      'connection lost',
      'server closed the connection',
      'timeout',
    ];

    return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = AdvancedTransactionManagerStrategy.RETRY_DELAY_MS;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * baseDelay;

    return Math.min(exponentialDelay + jitter, 5000); // Cap at 5 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Simple transaction manager for basic use cases
 */
export class SimpleTransactionManagerStrategy
  implements TransactionManagerStrategy
{
  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
    private readonly getRequestId: () => string,
  ) {}

  async execute<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<T>> {
    const requestId = this.getRequestId();
    const startTime = performance.now();

    return this.pool.transaction(async (connection) => {
      this.logger.debug(`[${requestId}] Simple transaction started`);

      try {
        if (options.isolationLevel) {
          await connection.query(
            sql.unsafe`SET TRANSACTION ISOLATION LEVEL ${sql.unsafe`${options.isolationLevel}`}`,
          );
        }

        const result = await handler(connection);
        const duration = performance.now() - startTime;

        this.logger.debug(
          `[${requestId}] Simple transaction completed in ${duration.toFixed(2)}ms`,
        );

        return {
          result,
          duration,
          operationsCount: 1, // Simple strategy doesn't count operations
        };
      } catch (error) {
        const duration = performance.now() - startTime;

        this.logger.error(
          `[${requestId}] Simple transaction failed after ${duration.toFixed(2)}ms`,
          {
            error: (error as Error).message,
          },
        );

        throw error;
      }
    });
  }
}

import { DatabasePool, DatabaseTransactionConnection } from 'slonik';
import { RequestContextService } from '@libs/application/context/AppRequestContext';
import { LoggerPort } from '../../ports/logger.port';

/**
 * Context information for database connections
 */
export interface ConnectionContext {
  requestId: string;
  transactionConnection?: DatabaseTransactionConnection;
  metadata: Record<string, unknown>;
}

/**
 * Strategy interface for managing database connection context
 */
export interface ConnectionContextStrategy {
  getContext(): ConnectionContext;
  getConnection(): DatabasePool | DatabaseTransactionConnection;
  getRequestId(): string;
  withTransaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
  ): Promise<T>;
}

/**
 * Advanced connection context strategy with request-scoped transaction management
 */
export class RequestScopedConnectionContextStrategy
  implements ConnectionContextStrategy
{
  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
  ) {}

  getContext(): ConnectionContext {
    try {
      const requestId = this.getRequestId();
      const transactionConnection = this.getTransactionConnection();

      return {
        requestId,
        transactionConnection: transactionConnection || undefined,
        metadata: {
          hasTransaction: !!transactionConnection,
          timestamp: new Date().toISOString(),
        },
      };
    } catch {
      // Fallback context when service is not available
      return {
        requestId: this.generateFallbackRequestId(),
        metadata: {
          hasTransaction: false,
          fallback: true,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  getConnection(): DatabasePool | DatabaseTransactionConnection {
    const context = this.getContext();
    return context.transactionConnection || this.pool;
  }

  getRequestId(): string {
    try {
      return RequestContextService.getRequestId();
    } catch {
      return this.generateFallbackRequestId();
    }
  }

  async withTransaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
  ): Promise<T> {
    const existingTransaction = this.getTransactionConnection();

    if (existingTransaction) {
      // Reuse existing transaction
      this.logger.debug(
        `[${this.getRequestId()}] Reusing existing transaction context`,
      );
      return handler(existingTransaction);
    }

    // Create new transaction
    return this.pool.transaction(async (connection) => {
      const requestId = this.getRequestId();

      this.logger.debug(`[${requestId}] Creating new transaction context`);

      try {
        // Set transaction in context for nested operations
        RequestContextService.setTransactionConnection(connection);

        const result = await handler(connection);

        this.logger.debug(
          `[${requestId}] Transaction context completed successfully`,
        );

        return result;
      } catch (error) {
        this.logger.error(`[${requestId}] Transaction context failed`, {
          error: (error as Error).message,
          errorType: (error as Error).constructor.name,
        });
        throw error;
      } finally {
        try {
          RequestContextService.cleanTransactionConnection();
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  }

  private getTransactionConnection(): DatabaseTransactionConnection | null {
    try {
      const connection = RequestContextService.getTransactionConnection();
      return connection ?? null;
    } catch {
      return null;
    }
  }

  private generateFallbackRequestId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Simple connection context strategy for basic use cases
 */
export class SimpleConnectionContextStrategy
  implements ConnectionContextStrategy
{
  private requestIdCounter = 0;

  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
  ) {}

  getContext(): ConnectionContext {
    return {
      requestId: this.getRequestId(),
      metadata: {
        hasTransaction: false,
        simple: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  getConnection(): DatabasePool {
    return this.pool;
  }

  getRequestId(): string {
    return `simple-${++this.requestIdCounter}`;
  }

  async withTransaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
  ): Promise<T> {
    const requestId = this.getRequestId();

    return this.pool.transaction(async (connection) => {
      this.logger.debug(`[${requestId}] Simple transaction started`);

      try {
        const result = await handler(connection);

        this.logger.debug(`[${requestId}] Simple transaction completed`);

        return result;
      } catch (error) {
        this.logger.error(`[${requestId}] Simple transaction failed`, {
          error: (error as Error).message,
        });
        throw error;
      }
    });
  }
}

/**
 * Mock connection context strategy for testing
 */
export class MockConnectionContextStrategy
  implements ConnectionContextStrategy
{
  private mockRequestId = 'mock-request-id';
  private mockTransactionConnection?: DatabaseTransactionConnection;

  constructor(
    private readonly pool: DatabasePool,
    private readonly logger: LoggerPort,
  ) {}

  getContext(): ConnectionContext {
    return {
      requestId: this.mockRequestId,
      transactionConnection: this.mockTransactionConnection,
      metadata: {
        hasTransaction: !!this.mockTransactionConnection,
        mock: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  getConnection(): DatabasePool | DatabaseTransactionConnection {
    return this.mockTransactionConnection || this.pool;
  }

  getRequestId(): string {
    return this.mockRequestId;
  }

  async withTransaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
  ): Promise<T> {
    return this.pool.transaction(async (connection) => {
      this.mockTransactionConnection = connection;

      try {
        const result = await handler(connection);
        return result;
      } finally {
        this.mockTransactionConnection = undefined;
      }
    });
  }

  // Test utilities
  setMockRequestId(requestId: string): void {
    this.mockRequestId = requestId;
  }

  setMockTransactionConnection(
    connection?: DatabaseTransactionConnection,
  ): void {
    this.mockTransactionConnection = connection;
  }
}

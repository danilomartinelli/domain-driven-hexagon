/**
 * Comprehensive tests for Query Execution Strategy pattern
 * Tests both Pool and Transaction execution strategies with performance validation
 */

import { SqlToken } from 'slonik';
import {
  QueryExecutionStrategy,
  PoolQueryExecutionStrategy,
  TransactionQueryExecutionStrategy,
} from '@libs/db/strategies/query-execution.strategy';
import {
  MockDatabasePool,
  MockTransactionConnection,
  MockLogger,
  PerformanceMeasurement,
  BenchmarkRunner,
} from '../utils/refactoring-test.utils';

describe('QueryExecutionStrategy', () => {
  let mockPool: MockDatabasePool;
  let mockTransaction: MockTransactionConnection;
  let mockLogger: MockLogger;
  let poolStrategy: PoolQueryExecutionStrategy;
  let transactionStrategy: TransactionQueryExecutionStrategy;

  const mockSqlToken = { toString: () => 'SELECT * FROM users' } as SqlToken;
  const getRequestId = () => 'test-request-123';
  const tableName = 'users';

  beforeEach(() => {
    mockPool = new MockDatabasePool('query-execution-test');
    mockTransaction = new MockTransactionConnection('transaction-test');
    mockLogger = new MockLogger();

    poolStrategy = new PoolQueryExecutionStrategy(
      mockPool as any,
      mockLogger,
      tableName,
      getRequestId,
    );

    transactionStrategy = new TransactionQueryExecutionStrategy(
      mockTransaction as any,
      mockLogger,
      tableName,
      getRequestId,
    );

    PerformanceMeasurement.reset();
  });

  afterEach(() => {
    mockPool.reset();
    mockTransaction.reset();
    mockLogger.clear();
    PerformanceMeasurement.reset();
  });

  describe('PoolQueryExecutionStrategy', () => {
    describe('executeQuery', () => {
      it('should execute query successfully and log performance', async () => {
        // Arrange
        const expectedResult = {
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'SELECT',
        };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const result = await poolStrategy.executeQuery(
          mockSqlToken,
          'findUser',
        );

        // Assert
        expect(result).toEqual(expectedResult);
        expect(mockPool.getQueryCallCount(mockSqlToken.toString())).toBe(1);
        expect(
          mockLogger.hasLogWithMessage('Executing findUser on table "users"'),
        ).toBe(true);
        expect(mockLogger.hasLogWithMessage('Query completed: findUser')).toBe(
          true,
        );
      });

      it('should detect and log slow queries', async () => {
        // Arrange
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _slowQueryThreshold = 1000; // 1 second
        const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);
        mockPool.setLatency(1200); // Simulate 1.2 second delay

        // Act
        await poolStrategy.executeQuery(mockSqlToken, 'slowQuery');

        // Assert
        expect(mockLogger.hasLogWithMessage('Slow query detected')).toBe(true);
        const slowQueryLogs = mockLogger.getLogsByLevel('warn');
        expect(slowQueryLogs.length).toBeGreaterThan(0);
        expect(slowQueryLogs[0].context?.severity).toBe('MEDIUM');
      });

      it('should log high severity for very slow queries', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);
        mockPool.setLatency(6000); // Simulate 6 second delay (above timeout warning)

        // Act
        await poolStrategy.executeQuery(mockSqlToken, 'verySlowQuery');

        // Assert
        const slowQueryLogs = mockLogger.getLogsByLevel('warn');
        expect(slowQueryLogs[0].context?.severity).toBe('HIGH');
      });

      it('should handle query errors gracefully', async () => {
        // Arrange
        const testError = new Error('Database connection failed');
        mockPool.simulateError(testError);

        // Act & Assert
        await expect(
          poolStrategy.executeQuery(mockSqlToken, 'failingQuery'),
        ).rejects.toThrow('Database connection failed');

        expect(mockLogger.hasLogWithMessage('Query failingQuery failed')).toBe(
          true,
        );
        const errorLogs = mockLogger.getLogsByLevel('error');
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs[0].context?.errorType).toBe('Error');
      });

      it('should include request ID in all log messages', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        await poolStrategy.executeQuery(mockSqlToken, 'requestIdTest');

        // Assert
        const logs = mockLogger.getLogs();
        logs.forEach((log) => {
          expect(log.message).toContain('[test-request-123]');
        });
      });
    });

    describe('executeWriteQuery', () => {
      it('should execute write query with entity tracking', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 2, command: 'UPDATE' };
        const entityIds = ['user-1', 'user-2'];
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const result = await poolStrategy.executeWriteQuery(
          mockSqlToken,
          'updateUsers',
          entityIds,
        );

        // Assert
        expect(result).toEqual(expectedResult);
        expect(
          mockLogger.hasLogWithMessage('Write operation updateUsers completed'),
        ).toBe(true);

        const logs = mockLogger.getLogs();
        const writeLog = logs.find((log) =>
          log.message.includes('Write operation updateUsers completed'),
        );
        expect(writeLog?.context?.entityCount).toBe(2);
        expect(writeLog?.context?.affectedRows).toBe(2);
      });

      it('should limit logged entity IDs to prevent log bloat', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 10, command: 'DELETE' };
        const manyEntityIds = Array.from(
          { length: 10 },
          (_, i) => `user-${i + 1}`,
        );
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        await poolStrategy.executeWriteQuery(
          mockSqlToken,
          'deleteManyUsers',
          manyEntityIds,
        );

        // Assert
        const logs = mockLogger.getLogs();
        const writeLog = logs.find((log) =>
          log.message.includes('Write operation deleteManyUsers completed'),
        );
        expect(writeLog?.context?.entities).toHaveLength(5); // Should limit to first 5
        expect(writeLog?.context?.hasMore).toBe(true);
      });

      it('should handle write query failures with entity context', async () => {
        // Arrange
        const testError = new Error('Constraint violation');
        const entityIds = ['user-1', 'user-2'];
        mockPool.simulateError(testError);

        // Act & Assert
        await expect(
          poolStrategy.executeWriteQuery(
            mockSqlToken,
            'failingWrite',
            entityIds,
          ),
        ).rejects.toThrow('Constraint violation');

        const errorLogs = mockLogger.getLogsByLevel('error');
        expect(errorLogs[0].context?.entityCount).toBe(2);
      });
    });

    describe('Performance Characteristics', () => {
      it('should have minimal performance overhead', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const benchmark = await BenchmarkRunner.run(
          'pool-strategy-overhead',
          () => poolStrategy.executeQuery(mockSqlToken, 'performanceTest'),
          50,
        );

        // Assert
        // Strategy overhead should be less than 5ms on average
        expect(benchmark.stats.avg).toBeLessThan(5);
        expect(benchmark.stats.percentile95).toBeLessThan(10);
      });

      it('should handle concurrent executions efficiently', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
        mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const concurrentQueries = Array.from({ length: 20 }, (_, i) =>
          poolStrategy.executeQuery(mockSqlToken, `concurrent-${i}`),
        );

        const startTime = performance.now();
        await Promise.all(concurrentQueries);
        const duration = performance.now() - startTime;

        // Assert
        // All queries should complete within reasonable time
        expect(duration).toBeLessThan(100); // 100ms for 20 concurrent queries
        expect(mockPool.getQueryCallCount(mockSqlToken.toString())).toBe(20);
      });
    });
  });

  describe('TransactionQueryExecutionStrategy', () => {
    describe('executeQuery', () => {
      it('should execute query within transaction context', async () => {
        // Arrange
        const expectedResult = {
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'SELECT',
        };
        mockTransaction.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const result = await transactionStrategy.executeQuery(
          mockSqlToken,
          'txFindUser',
        );

        // Assert
        expect(result).toEqual(expectedResult);
        expect(mockTransaction.getQueryCallCount(mockSqlToken.toString())).toBe(
          1,
        );
        expect(
          mockLogger.hasLogWithMessage('Executing transactional txFindUser'),
        ).toBe(true);
      });

      it('should handle transaction-specific errors', async () => {
        // Arrange
        const txError = new Error('Transaction aborted');
        mockTransaction.simulateError(txError);

        // Act & Assert
        await expect(
          transactionStrategy.executeQuery(mockSqlToken, 'txFailingQuery'),
        ).rejects.toThrow('Transaction aborted');

        expect(
          mockLogger.hasLogWithMessage(
            'Transactional query txFailingQuery failed',
          ),
        ).toBe(true);
      });
    });

    describe('executeWriteQuery', () => {
      it('should execute transactional write operations', async () => {
        // Arrange
        const expectedResult = { rows: [], rowCount: 3, command: 'INSERT' };
        const entityIds = ['user-1', 'user-2', 'user-3'];
        mockTransaction.setQueryResult(mockSqlToken.toString(), expectedResult);

        // Act
        const result = await transactionStrategy.executeWriteQuery(
          mockSqlToken,
          'txInsertUsers',
          entityIds,
        );

        // Assert
        expect(result).toEqual(expectedResult);
        expect(
          mockLogger.hasLogWithMessage(
            'Transactional write txInsertUsers completed',
          ),
        ).toBe(true);
      });
    });
  });

  describe('Strategy Pattern Compliance', () => {
    it('should implement QueryExecutionStrategy interface correctly', () => {
      // Verify both strategies implement the interface
      expect(poolStrategy).toHaveProperty('executeQuery');
      expect(poolStrategy).toHaveProperty('executeWriteQuery');
      expect(transactionStrategy).toHaveProperty('executeQuery');
      expect(transactionStrategy).toHaveProperty('executeWriteQuery');

      // Verify methods are functions
      expect(typeof poolStrategy.executeQuery).toBe('function');
      expect(typeof poolStrategy.executeWriteQuery).toBe('function');
      expect(typeof transactionStrategy.executeQuery).toBe('function');
      expect(typeof transactionStrategy.executeWriteQuery).toBe('function');
    });

    it('should allow strategy swapping without breaking functionality', async () => {
      // Arrange
      const expectedResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
      };
      mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);
      mockTransaction.setQueryResult(mockSqlToken.toString(), expectedResult);

      // Act & Assert - Pool strategy
      let strategy: QueryExecutionStrategy = poolStrategy;
      let result = await strategy.executeQuery(mockSqlToken, 'strategyTest');
      expect(result).toEqual(expectedResult);

      // Act & Assert - Transaction strategy
      strategy = transactionStrategy;
      result = await strategy.executeQuery(mockSqlToken, 'strategyTest');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Error Classification and Handling', () => {
    it('should classify different types of database errors', async () => {
      const errorTypes = [
        { error: new Error('Connection timeout'), expectedType: 'Error' },
        { error: new TypeError('Invalid argument'), expectedType: 'TypeError' },
        {
          error: new RangeError('Value out of range'),
          expectedType: 'RangeError',
        },
      ];

      for (const { error, expectedType } of errorTypes) {
        // Arrange
        mockPool.simulateError(error);

        // Act & Assert
        await expect(
          poolStrategy.executeQuery(mockSqlToken, 'errorClassificationTest'),
        ).rejects.toThrow(error.message);

        const errorLogs = mockLogger.getLogsByLevel('error');
        const latestLog = errorLogs[errorLogs.length - 1];
        expect(latestLog.context?.errorType).toBe(expectedType);

        // Reset for next test
        mockPool.resetError();
        mockLogger.clear();
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated operations', async () => {
      // Arrange
      const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
      mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

      // Measure initial memory
      const initialMemory = process.memoryUsage();

      // Act - Perform many operations
      for (let i = 0; i < 1000; i++) {
        await poolStrategy.executeQuery(mockSqlToken, `memoryTest-${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Measure final memory
      const finalMemory = process.memoryUsage();

      // Assert - Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Memory increase should be less than 1MB for 1000 operations
      expect(memoryIncreaseKB).toBeLessThan(1024);
    });

    it('should release resources properly after errors', async () => {
      // Arrange
      const testError = new Error('Resource test error');
      mockPool.simulateError(testError);

      // Act
      try {
        await poolStrategy.executeQuery(mockSqlToken, 'resourceTest');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Expected to fail
      }

      // Reset error state
      mockPool.resetError();

      // Verify strategy can still operate normally
      const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
      mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

      // Should not throw
      const result = await poolStrategy.executeQuery(
        mockSqlToken,
        'recoveryTest',
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Integration with Generic Types', () => {
    interface TestUser {
      id: number;
      email: string;
      role: string;
    }

    it('should maintain type safety with generic query results', async () => {
      // Arrange
      const expectedResult = {
        rows: [{ id: 1, email: 'test@example.com', role: 'user' }],
        rowCount: 1,
        command: 'SELECT',
      };
      mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

      // Act
      const result = await poolStrategy.executeQuery<TestUser>(
        mockSqlToken,
        'typedQuery',
      );

      // Assert
      expect(result.rows[0].id).toBe(1);
      expect(result.rows[0].email).toBe('test@example.com');
      expect(result.rows[0].role).toBe('user');

      // TypeScript should enforce type safety at compile time
      // This test ensures runtime behavior matches type expectations
    });

    it('should handle empty results with proper typing', async () => {
      // Arrange
      const expectedResult = { rows: [], rowCount: 0, command: 'SELECT' };
      mockPool.setQueryResult(mockSqlToken.toString(), expectedResult);

      // Act
      const result = await poolStrategy.executeQuery<TestUser>(
        mockSqlToken,
        'emptyTypedQuery',
      );

      // Assert
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });
});

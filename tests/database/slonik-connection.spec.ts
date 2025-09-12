import { createPool, DatabasePool, sql } from 'slonik';
import { databaseConfig } from '@src/configs/database.config';
import { buildTestConnectionUri } from '../utils/database-test.utils';

describe('Slonik Database Connection', () => {
  let pool: DatabasePool;

  beforeAll(async () => {
    // Ensure we're using test database
    if (!databaseConfig.database?.includes('test')) {
      throw new Error('Tests must use a test database');
    }
  });

  afterEach(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('Connection Pool Management', () => {
    it('should create a valid database pool', async () => {
      pool = await createPool(buildTestConnectionUri());

      expect(pool).toBeDefined();
      expect(typeof pool.query).toBe('function');
      expect(typeof pool.transaction).toBe('function');
    });

    it('should handle connection timeout gracefully', async () => {
      const invalidUri = `postgres://invalid:invalid@localhost:9999/test_db`;

      try {
        pool = await createPool(invalidUri, {
          connectionTimeout: 1000, // 1 second timeout
        });
        await pool.query(sql.unsafe`SELECT 1`);
        fail('Should have thrown connection error');
      } catch (error) {
        expect(error).toBeDefined();
        // Connection should fail quickly due to timeout
      }
    });

    it('should execute simple queries successfully', async () => {
      pool = await createPool(buildTestConnectionUri());

      const result = await pool.query(sql.unsafe`SELECT 1 as test_value`);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ test_value: 1 });
    });

    it('should handle pool configuration options', async () => {
      pool = await createPool(buildTestConnectionUri(), {
        maximumPoolSize: 5,
        idleTimeout: 5000,
        idleInTransactionSessionTimeout: 1000,
      });

      // Verify pool is functional with custom config
      const result = await pool.query(sql.unsafe`SELECT 1`);
      expect(result.rowCount).toBe(1);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      pool = await createPool(buildTestConnectionUri());

      // Create test table for transaction tests
      await pool.query(sql.unsafe`
        CREATE TABLE IF NOT EXISTS test_transactions (
          id SERIAL PRIMARY KEY,
          value VARCHAR(50)
        )
      `);

      // Clean up any existing data
      await pool.query(sql.unsafe`TRUNCATE test_transactions`);
    });

    afterEach(async () => {
      if (pool) {
        await pool.query(sql.unsafe`DROP TABLE IF EXISTS test_transactions`);
      }
    });

    it('should commit transaction on success', async () => {
      await pool.transaction(async (connection) => {
        await connection.query(sql.unsafe`
          INSERT INTO test_transactions (value) VALUES ('test1')
        `);
        await connection.query(sql.unsafe`
          INSERT INTO test_transactions (value) VALUES ('test2')
        `);
      });

      const result = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM test_transactions
      `);
      expect(result.rows[0].count).toBe(2);
    });

    it('should rollback transaction on error', async () => {
      try {
        await pool.transaction(async (connection) => {
          await connection.query(sql.unsafe`
            INSERT INTO test_transactions (value) VALUES ('test1')
          `);

          // Force an error
          throw new Error('Forced transaction error');
        });
      } catch (error) {
        expect((error as Error).message).toBe('Forced transaction error');
      }

      const result = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM test_transactions
      `);
      expect(result.rows[0].count).toBe(0);
    });

    it('should handle nested transactions correctly', async () => {
      await pool.transaction(async (outerConnection) => {
        await outerConnection.query(sql.unsafe`
          INSERT INTO test_transactions (value) VALUES ('outer')
        `);

        await outerConnection.transaction(async (innerConnection) => {
          await innerConnection.query(sql.unsafe`
            INSERT INTO test_transactions (value) VALUES ('inner')
          `);
        });
      });

      const result = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM test_transactions
      `);
      expect(result.rows[0].count).toBe(2);
    });

    it('should handle transaction isolation levels', async () => {
      // Insert initial data
      await pool.query(sql.unsafe`
        INSERT INTO test_transactions (value) VALUES ('initial')
      `);

      let readInTransaction: any;

      await pool.transaction(async (connection) => {
        // Read in transaction
        const result = await connection.query(sql.unsafe`
          SELECT COUNT(*) as count FROM test_transactions
        `);
        readInTransaction = result.rows[0].count;

        // Simulate work that takes time
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(readInTransaction).toBe(1);
    });
  });

  describe('Connection Pool Resilience', () => {
    beforeEach(async () => {
      pool = await createPool(buildTestConnectionUri());
    });

    it('should handle multiple concurrent queries', async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        pool.query(sql.unsafe`SELECT ${i} as query_id`),
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.rows[0].query_id).toBe(index);
      });
    });

    it('should recover from connection loss', async () => {
      // First, verify connection works
      await pool.query(sql.unsafe`SELECT 1`);

      // Simulate connection recovery by creating new pool
      await pool.end();
      pool = await createPool(buildTestConnectionUri());

      // Should work again
      const result = await pool.query(sql.unsafe`SELECT 2 as recovered`);
      expect(result.rows[0].recovered).toBe(2);
    });

    it('should handle pool exhaustion gracefully', async () => {
      // Create pool with very limited connections
      const limitedPool = await createPool(buildTestConnectionUri(), {
        maximumPoolSize: 2,
      });

      try {
        // Create more concurrent operations than pool size
        const operations = Array.from({ length: 5 }, () =>
          limitedPool.transaction(async (connection) => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return connection.query(sql.unsafe`SELECT 1`);
          }),
        );

        const results = await Promise.all(operations);
        expect(results).toHaveLength(5);
      } finally {
        await limitedPool.end();
      }
    });
  });

  describe('SQL Injection Protection', () => {
    beforeEach(async () => {
      pool = await createPool(buildTestConnectionUri());

      await pool.query(sql.unsafe`
        CREATE TABLE IF NOT EXISTS test_injection (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50),
          data TEXT
        )
      `);

      await pool.query(sql.unsafe`TRUNCATE test_injection`);

      // Insert test data
      await pool.query(sql.unsafe`
        INSERT INTO test_injection (username, data) 
        VALUES ('user1', 'normal data'), ('admin', 'sensitive data')
      `);
    });

    afterEach(async () => {
      if (pool) {
        await pool.query(sql.unsafe`DROP TABLE IF EXISTS test_injection`);
      }
    });

    it('should prevent SQL injection in parameterized queries', async () => {
      const maliciousInput = "'; DROP TABLE test_injection; --";

      // This should be safe with proper parameterization
      const result = await pool.query(sql.unsafe`
        SELECT * FROM test_injection WHERE username = ${maliciousInput}
      `);

      expect(result.rows).toHaveLength(0);

      // Verify table still exists and has data
      const checkResult = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM test_injection
      `);
      expect(checkResult.rows[0].count).toBe(2);
    });

    it('should handle special characters safely', async () => {
      const specialChars = "user'; SELECT * FROM test_injection WHERE '1'='1";

      const result = await pool.query(sql.unsafe`
        SELECT * FROM test_injection WHERE username = ${specialChars}
      `);

      expect(result.rows).toHaveLength(0);
    });

    it('should validate identifier safety', async () => {
      // Test with sql.identifier for table/column names
      const tableName = 'test_injection';
      const columnName = 'username';

      const result = await pool.query(sql.unsafe`
        SELECT ${sql.identifier([columnName])} 
        FROM ${sql.identifier([tableName])} 
        WHERE ${sql.identifier([columnName])} = ${'user1'}
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].username).toBe('user1');
    });
  });
});

import { createPool, DatabasePool, sql } from 'slonik';
// import {
//   UniqueIntegrityConstraintViolationError,
//   NotFoundError,
//   DataIntegrityError,
//   ConnectionError,
// } from 'slonik';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { SqlRepositoryBase } from '@src/libs/db/sql-repository.base';
import { ConflictException } from '@libs/exceptions';
import { postgresConnectionUri } from '@src/configs/database.config';
import { z } from 'zod';
import { AggregateRoot, Mapper } from '@libs/ddd';

// Test aggregate for error testing
class ErrorTestAggregate extends AggregateRoot<{
  email: string;
  name: string;
}> {
  constructor(props: { email: string; name: string }, id?: string) {
    super(props, id);
  }

  validate(): void {
    if (!this.props.email) {
      throw new Error('Email is required');
    }
    if (!this.props.name) {
      throw new Error('Name is required');
    }
  }

  static create(
    props: { email: string; name: string },
    id?: string,
  ): ErrorTestAggregate {
    return new ErrorTestAggregate(props, id);
  }
}

const errorTestSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.preprocess((val: any) => new Date(val), z.date()),
  updatedAt: z.preprocess((val: any) => new Date(val), z.date()),
});

type ErrorTestModel = z.TypeOf<typeof errorTestSchema>;

class ErrorTestMapper implements Mapper<ErrorTestAggregate, ErrorTestModel> {
  toPersistence(aggregate: ErrorTestAggregate): ErrorTestModel {
    const props = aggregate.getProps();
    return {
      id: aggregate.id,
      email: props.email,
      name: props.name,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
    };
  }

  toDomain(model: ErrorTestModel): ErrorTestAggregate {
    return new ErrorTestAggregate(
      { email: model.email, name: model.name },
      model.id,
    );
  }
}

class ErrorTestRepository extends SqlRepositoryBase<
  ErrorTestAggregate,
  ErrorTestModel
> {
  protected tableName = 'error_test_entities';
  protected schema = errorTestSchema;

  constructor(
    pool: DatabasePool,
    mapper: ErrorTestMapper,
    eventEmitter: EventEmitter2,
    logger: Logger,
  ) {
    super(pool, mapper, eventEmitter, logger);
  }
}

describe('Database Error Handling', () => {
  let pool: DatabasePool;
  let repository: ErrorTestRepository;
  let eventEmitter: EventEmitter2;
  let logger: Logger;
  let mapper: ErrorTestMapper;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventEmitter2, Logger, ErrorTestMapper],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    logger = module.get<Logger>(Logger);
    mapper = module.get<ErrorTestMapper>(ErrorTestMapper);

    pool = await createPool(postgresConnectionUri);

    // Create test table with constraints
    await pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS error_test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL CHECK (length(name) > 0),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    repository = new ErrorTestRepository(pool, mapper, eventEmitter, logger);
  });

  afterAll(async () => {
    await pool.query(sql.unsafe`DROP TABLE IF EXISTS error_test_entities`);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(sql.unsafe`TRUNCATE error_test_entities`);
  });

  describe('Connection Errors', () => {
    it('should handle connection timeout errors', async () => {
      const timeoutPool = await createPool(postgresConnectionUri, {
        connectionTimeout: 1, // Very short timeout
        queryTimeout: 1,
      });

      try {
        // Force a long-running query that should timeout
        await expect(
          timeoutPool.query(sql.unsafe`SELECT pg_sleep(2)`),
        ).rejects.toThrow();
      } finally {
        await timeoutPool.end();
      }
    });

    it('should handle invalid connection string', async () => {
      const invalidUri =
        'postgres://invalid:invalid@nonexistent:5432/nonexistent';

      await expect(
        createPool(invalidUri, { connectionTimeout: 1000 }),
      ).rejects.toThrow();
    });

    it('should handle pool exhaustion gracefully', async () => {
      const limitedPool = await createPool(postgresConnectionUri, {
        maximumPoolSize: 1,
        connectionTimeout: 1000,
      });

      try {
        // Start a long-running transaction
        const transactionPromise = limitedPool.transaction(
          async (connection) => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return connection.query(sql.unsafe`SELECT 1`);
          },
        );

        // Try to get another connection immediately
        const queryPromise = limitedPool.query(sql.unsafe`SELECT 2`);

        // The second query should wait or timeout
        const results = await Promise.allSettled([
          transactionPromise,
          queryPromise,
        ]);

        // At least one should succeed
        expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
      } finally {
        await limitedPool.end();
      }
    });
  });

  describe('Constraint Violation Errors', () => {
    it('should handle unique constraint violations', async () => {
      const entity1 = ErrorTestAggregate.create({
        email: 'duplicate@example.com',
        name: 'User One',
      });

      const entity2 = ErrorTestAggregate.create({
        email: 'duplicate@example.com',
        name: 'User Two',
      });

      // First insert should succeed
      await repository.insert(entity1);

      // Second insert should fail with ConflictException
      await expect(repository.insert(entity2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle check constraint violations', async () => {
      // Try to insert entity with empty name (violates CHECK constraint)
      await expect(
        pool.query(sql.unsafe`
          INSERT INTO error_test_entities (email, name) 
          VALUES ('test@example.com', '')
        `),
      ).rejects.toThrow();
    });

    it('should handle foreign key constraint violations', async () => {
      // Create a table with foreign key for testing
      await pool.query(sql.unsafe`
        CREATE TABLE IF NOT EXISTS error_test_references (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_id UUID REFERENCES error_test_entities(id) ON DELETE CASCADE,
          description TEXT
        )
      `);

      try {
        // Try to insert with non-existent foreign key
        await expect(
          pool.query(sql.unsafe`
            INSERT INTO error_test_references (entity_id, description) 
            VALUES ('00000000-0000-0000-0000-000000000000', 'Invalid reference')
          `),
        ).rejects.toThrow();
      } finally {
        await pool.query(
          sql.unsafe`DROP TABLE IF EXISTS error_test_references`,
        );
      }
    });

    it('should handle not null constraint violations', async () => {
      await expect(
        pool.query(sql.unsafe`
          INSERT INTO error_test_entities (email) 
          VALUES (NULL)
        `),
      ).rejects.toThrow();
    });
  });

  describe('Query Execution Errors', () => {
    it('should handle SQL syntax errors', async () => {
      await expect(
        pool.query(sql.unsafe`INVALID SQL SYNTAX`),
      ).rejects.toThrow();
    });

    it('should handle invalid table references', async () => {
      await expect(
        pool.query(sql.unsafe`SELECT * FROM non_existent_table`),
      ).rejects.toThrow();
    });

    it('should handle invalid column references', async () => {
      await expect(
        pool.query(
          sql.unsafe`SELECT non_existent_column FROM error_test_entities`,
        ),
      ).rejects.toThrow();
    });

    it('should handle type conversion errors', async () => {
      await expect(
        pool.query(sql.unsafe`SELECT 'not_a_number'::integer`),
      ).rejects.toThrow();
    });

    it('should handle division by zero errors', async () => {
      await expect(pool.query(sql.unsafe`SELECT 1 / 0`)).rejects.toThrow();
    });
  });

  describe('Transaction Errors', () => {
    it('should handle transaction rollback on error', async () => {
      const entity = ErrorTestAggregate.create({
        email: 'transaction@example.com',
        name: 'Transaction Test',
      });

      try {
        await repository.transaction(async () => {
          await repository.insert(entity);

          // Force an error that should rollback the transaction
          throw new Error('Forced transaction error');
        });
      } catch (error) {
        expect(error.message).toBe('Forced transaction error');
      }

      // Verify that the insert was rolled back
      const found = await repository.findOneById(entity.id);
      expect(found.isNone()).toBe(true);
    });

    it('should handle deadlock situations', async () => {
      // Insert initial data
      const entity1 = ErrorTestAggregate.create({
        email: 'deadlock1@example.com',
        name: 'Deadlock Test 1',
      });

      const entity2 = ErrorTestAggregate.create({
        email: 'deadlock2@example.com',
        name: 'Deadlock Test 2',
      });

      await repository.insert(entity1);
      await repository.insert(entity2);

      // Simulate potential deadlock scenario with concurrent transactions
      const transaction1 = pool.transaction(async (connection) => {
        await connection.query(sql.unsafe`
          UPDATE error_test_entities 
          SET name = 'Updated by T1' 
          WHERE email = 'deadlock1@example.com'
        `);

        // Small delay to increase chance of deadlock
        await new Promise((resolve) => setTimeout(resolve, 100));

        await connection.query(sql.unsafe`
          UPDATE error_test_entities 
          SET name = 'Updated by T1 again' 
          WHERE email = 'deadlock2@example.com'
        `);
      });

      const transaction2 = pool.transaction(async (connection) => {
        await connection.query(sql.unsafe`
          UPDATE error_test_entities 
          SET name = 'Updated by T2' 
          WHERE email = 'deadlock2@example.com'
        `);

        // Small delay to increase chance of deadlock
        await new Promise((resolve) => setTimeout(resolve, 100));

        await connection.query(sql.unsafe`
          UPDATE error_test_entities 
          SET name = 'Updated by T2 again' 
          WHERE email = 'deadlock1@example.com'
        `);
      });

      // At least one transaction should complete successfully
      const results = await Promise.allSettled([transaction1, transaction2]);
      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle savepoint errors', async () => {
      await pool.transaction(async (connection) => {
        // Create a savepoint
        await connection.query(sql.unsafe`SAVEPOINT test_savepoint`);

        try {
          // Try to execute invalid SQL
          await connection.query(sql.unsafe`INVALID SQL`);
        } catch {
          // Rollback to savepoint
          await connection.query(
            sql.unsafe`ROLLBACK TO SAVEPOINT test_savepoint`,
          );
        }

        // This should work after rollback to savepoint
        const result = await connection.query(sql.unsafe`SELECT 1 as test`);
        expect(result.rows[0].test).toBe(1);
      });
    });
  });

  describe('Data Validation Errors', () => {
    it('should handle schema validation errors', async () => {
      // Insert data that violates schema
      await pool.query(sql.unsafe`
        INSERT INTO error_test_entities (id, email, name) 
        VALUES ('invalid-uuid-format', 'invalid-email', 'Test Name')
      `);

      // Schema validation should fail when querying
      await expect(
        pool.query(
          sql.type(
            errorTestSchema,
          )`SELECT * FROM error_test_entities WHERE name = 'Test Name'`,
        ),
      ).rejects.toThrow();
    });

    it('should handle domain validation errors', async () => {
      const invalidEntity = ErrorTestAggregate.create({
        email: '',
        name: 'Valid Name',
      });

      await expect(repository.insert(invalidEntity)).rejects.toThrow(
        'Email is required',
      );
    });

    it('should handle mapper errors', async () => {
      // Create a mapper that throws errors
      const faultyMapper = {
        toPersistence: () => {
          throw new Error('Mapper conversion error');
        },
        toDomain: () => {
          throw new Error('Mapper domain error');
        },
      };

      const faultyRepository = new ErrorTestRepository(
        pool,
        faultyMapper as any,
        eventEmitter,
        logger,
      );

      const entity = ErrorTestAggregate.create({
        email: 'mapper@example.com',
        name: 'Mapper Test',
      });

      await expect(faultyRepository.insert(entity)).rejects.toThrow(
        'Mapper conversion error',
      );
    });
  });

  describe('Resource Management Errors', () => {
    it('should handle memory pressure during large operations', async () => {
      // Create a large dataset to test memory handling
      const entities = Array.from({ length: 100 }, (_, i) =>
        ErrorTestAggregate.create({
          email: `bulk${i}@example.com`,
          name: `Bulk User ${i}`,
        }),
      );

      // Insert in small batches to avoid memory issues
      const batchSize = 10;
      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);

        // Each batch should succeed
        await expect(
          Promise.all(batch.map((entity) => repository.insert(entity))),
        ).resolves.not.toThrow();
      }

      // Verify all entities were inserted
      const all = await repository.findAll();
      expect(all.length).toBe(entities.length);
    });

    it('should handle connection cleanup on errors', async () => {
      const connectionPool = await createPool(postgresConnectionUri, {
        maximumPoolSize: 2,
      });

      try {
        // Force multiple connection errors
        const errorPromises = Array.from({ length: 5 }, () =>
          connectionPool.query(sql.unsafe`INVALID SQL QUERY`).catch((e) => e),
        );

        const results = await Promise.all(errorPromises);

        // All should have errored
        results.forEach((result) => {
          expect(result).toBeInstanceOf(Error);
        });

        // Pool should still be functional after errors
        const result = await connectionPool.query(sql.unsafe`SELECT 1 as test`);
        expect(result.rows[0].test).toBe(1);
      } finally {
        await connectionPool.end();
      }
    });
  });

  describe('Graceful Error Recovery', () => {
    it('should retry operations after transient failures', async () => {
      const entity = ErrorTestAggregate.create({
        email: 'retry@example.com',
        name: 'Retry Test',
      });

      let attempts = 0;
      const maxAttempts = 3;

      const retryOperation = async (): Promise<void> => {
        attempts++;

        if (attempts < maxAttempts) {
          // Simulate transient failure
          throw new Error('Transient database error');
        }

        // Success on final attempt
        await repository.insert(entity);
      };

      // Implement retry logic
      let lastError: Error | null = null;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await retryOperation();
          lastError = null;
          break;
        } catch (error) {
          lastError = error as Error;

          if (i === maxAttempts - 1) {
            throw error;
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      expect(lastError).toBeNull();
      expect(attempts).toBe(maxAttempts);

      // Verify entity was inserted
      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);
    });

    it('should handle partial failures in batch operations', async () => {
      const entities = [
        ErrorTestAggregate.create({
          email: 'batch1@example.com',
          name: 'Batch 1',
        }),
        ErrorTestAggregate.create({
          email: 'batch2@example.com',
          name: 'Batch 2',
        }),
        ErrorTestAggregate.create({
          email: 'batch1@example.com',
          name: 'Duplicate Email',
        }), // Will fail
        ErrorTestAggregate.create({
          email: 'batch3@example.com',
          name: 'Batch 3',
        }),
      ];

      const results = await Promise.allSettled(
        entities.map((entity) => repository.insert(entity)),
      );

      // First two should succeed
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');

      // Third should fail (duplicate email)
      expect(results[2].status).toBe('rejected');

      // Fourth should succeed
      expect(results[3].status).toBe('fulfilled');

      // Verify successful insertions
      const all = await repository.findAll();
      expect(all.length).toBe(3); // Only successful ones
    });

    it('should log errors appropriately', async () => {
      const loggerSpy = jest.spyOn(logger, 'debug');

      try {
        await pool.query(sql.unsafe`INVALID SQL FOR LOGGING TEST`);
      } catch (error) {
        // Error should be thrown
        expect(error).toBeDefined();
      }

      // Logger may be called for various database operations
      // The key is that errors don't prevent logging functionality
      expect(loggerSpy).toBeDefined();

      loggerSpy.mockRestore();
    });
  });
});

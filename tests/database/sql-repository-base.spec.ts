import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql, createPool } from 'slonik';
import { z } from 'zod';
import { SqlRepositoryBase } from '@src/libs/db/sql-repository.base';
import { AggregateRoot } from '@libs/ddd';
import { Mapper } from '@libs/ddd';
import { Logger } from '@nestjs/common';
// import { RequestContextService } from '@libs/application/context/AppRequestContext';
import { postgresConnectionUri } from '@src/configs/database.config';

// Test aggregate for testing purposes
class TestAggregate extends AggregateRoot<{ name: string; email: string }> {
  constructor(props: { name: string; email: string }, id?: string) {
    super(props, id);
  }

  validate(): void {
    if (!this.props.name) {
      throw new Error('Name is required');
    }
    if (!this.props.email) {
      throw new Error('Email is required');
    }
  }

  static create(
    props: { name: string; email: string },
    id?: string,
  ): TestAggregate {
    return new TestAggregate(props, id);
  }
}

// Test model schema
const testSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.preprocess((val: any) => new Date(val), z.date()),
  updatedAt: z.preprocess((val: any) => new Date(val), z.date()),
  name: z.string().min(1),
  email: z.string().email(),
});

type TestModel = z.TypeOf<typeof testSchema>;

// Test mapper
class TestMapper implements Mapper<TestAggregate, TestModel> {
  toPersistence(aggregate: TestAggregate): TestModel {
    const props = aggregate.getProps();
    return {
      id: aggregate.id,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      name: props.name,
      email: props.email,
    };
  }

  toDomain(model: TestModel): TestAggregate {
    return new TestAggregate(
      { name: model.name, email: model.email },
      model.id,
    );
  }
}

// Test repository implementation
class TestRepository extends SqlRepositoryBase<TestAggregate, TestModel> {
  protected tableName = 'test_entities';
  protected schema = testSchema;

  constructor(
    pool: DatabasePool,
    mapper: TestMapper,
    eventEmitter: EventEmitter2,
    logger: Logger,
  ) {
    super(pool, mapper, eventEmitter, logger);
  }

  async findByEmail(email: string): Promise<TestAggregate | null> {
    try {
      const result = await this.pool.one(
        sql.type(
          testSchema,
        )`SELECT * FROM "test_entities" WHERE email = ${email}`,
      );
      return this.mapper.toDomain(result);
    } catch {
      return null;
    }
  }
}

describe('SqlRepositoryBase', () => {
  let pool: DatabasePool;
  let repository: TestRepository;
  let eventEmitter: EventEmitter2;
  let logger: Logger;
  let mapper: TestMapper;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventEmitter2, Logger, TestMapper],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    logger = module.get<Logger>(Logger);
    mapper = module.get<TestMapper>(TestMapper);

    pool = await createPool(postgresConnectionUri);

    // Create test table
    await pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
      )
    `);

    repository = new TestRepository(pool, mapper, eventEmitter, logger);
  });

  afterAll(async () => {
    await pool.query(sql.unsafe`DROP TABLE IF EXISTS test_entities`);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(sql.unsafe`TRUNCATE test_entities`);
  });

  describe('Insert Operations', () => {
    it('should insert a single entity successfully', async () => {
      const entity = TestAggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });

      await repository.insert(entity);

      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);

      const foundEntity = found.unwrap();
      expect(foundEntity.getProps().name).toBe('John Doe');
      expect(foundEntity.getProps().email).toBe('john@example.com');
    });

    it('should insert multiple entities successfully', async () => {
      const entities = [
        TestAggregate.create({ name: 'John Doe', email: 'john@example.com' }),
        TestAggregate.create({ name: 'Jane Doe', email: 'jane@example.com' }),
      ];

      await repository.insert(entities);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it('should handle duplicate email constraint violation', async () => {
      const entity1 = TestAggregate.create({
        name: 'John Doe',
        email: 'duplicate@example.com',
      });

      const entity2 = TestAggregate.create({
        name: 'Jane Doe',
        email: 'duplicate@example.com',
      });

      await repository.insert(entity1);

      await expect(repository.insert(entity2)).rejects.toThrow();
    });

    it('should validate entity before insert', async () => {
      const invalidEntity = TestAggregate.create({
        name: '',
        email: 'test@example.com',
      });

      await expect(repository.insert(invalidEntity)).rejects.toThrow(
        'Name is required',
      );
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Insert test data
      const entities = [
        TestAggregate.create({ name: 'Alice', email: 'alice@example.com' }),
        TestAggregate.create({ name: 'Bob', email: 'bob@example.com' }),
        TestAggregate.create({ name: 'Charlie', email: 'charlie@example.com' }),
      ];

      for (const entity of entities) {
        await repository.insert(entity);
      }
    });

    it('should find entity by ID', async () => {
      const entities = await repository.findAll();
      const firstEntity = entities[0];

      const found = await repository.findOneById(firstEntity.id);

      expect(found.isSome()).toBe(true);
      expect(found.unwrap().id).toBe(firstEntity.id);
    });

    it('should return None for non-existent ID', async () => {
      const found = await repository.findOneById('non-existent-id');

      expect(found.isNone()).toBe(true);
    });

    it('should find all entities', async () => {
      const entities = await repository.findAll();

      expect(entities).toHaveLength(3);
      expect(entities.map((e) => e.getProps().name)).toContain('Alice');
      expect(entities.map((e) => e.getProps().name)).toContain('Bob');
      expect(entities.map((e) => e.getProps().name)).toContain('Charlie');
    });

    it('should find entities with pagination', async () => {
      const paginated = await repository.findAllPaginated({
        limit: 2,
        offset: 0,
        page: 1,
      });

      expect(paginated.data).toHaveLength(2);
      expect(paginated.limit).toBe(2);
      expect(paginated.page).toBe(1);
    });

    it('should handle custom repository methods', async () => {
      const found = await repository.findByEmail('alice@example.com');

      expect(found).toBeDefined();
      expect(found?.getProps().name).toBe('Alice');
    });
  });

  describe('Delete Operations', () => {
    let testEntity: TestAggregate;

    beforeEach(async () => {
      testEntity = TestAggregate.create({
        name: 'Delete Test',
        email: 'delete@example.com',
      });
      await repository.insert(testEntity);
    });

    it('should delete entity successfully', async () => {
      const result = await repository.delete(testEntity);

      expect(result).toBe(true);

      const found = await repository.findOneById(testEntity.id);
      expect(found.isNone()).toBe(true);
    });

    it('should return false when deleting non-existent entity', async () => {
      // Delete once
      await repository.delete(testEntity);

      // Try to delete again
      const result = await repository.delete(testEntity);

      expect(result).toBe(false);
    });

    it('should validate entity before delete', async () => {
      const invalidEntity = TestAggregate.create({
        name: '',
        email: 'invalid@example.com',
      });

      await expect(repository.delete(invalidEntity)).rejects.toThrow(
        'Name is required',
      );
    });
  });

  describe('Transaction Operations', () => {
    it('should execute operations within transaction', async () => {
      const entity1 = TestAggregate.create({
        name: 'Transaction Test 1',
        email: 'tx1@example.com',
      });

      const entity2 = TestAggregate.create({
        name: 'Transaction Test 2',
        email: 'tx2@example.com',
      });

      await repository.transaction(async () => {
        await repository.insert(entity1);
        await repository.insert(entity2);
      });

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it('should rollback transaction on error', async () => {
      const entity1 = TestAggregate.create({
        name: 'Transaction Test 1',
        email: 'tx1@example.com',
      });

      try {
        await repository.transaction(async () => {
          await repository.insert(entity1);
          throw new Error('Force rollback');
        });
      } catch (error) {
        expect(error.message).toBe('Force rollback');
      }

      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });

    it('should handle nested transactions', async () => {
      const entity1 = TestAggregate.create({
        name: 'Outer Transaction',
        email: 'outer@example.com',
      });

      const entity2 = TestAggregate.create({
        name: 'Inner Transaction',
        email: 'inner@example.com',
      });

      await repository.transaction(async () => {
        await repository.insert(entity1);

        await repository.transaction(async () => {
          await repository.insert(entity2);
        });
      });

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('Schema Validation', () => {
    it('should validate data according to schema', async () => {
      // Insert valid data that should pass schema validation
      const entity = TestAggregate.create({
        name: 'Schema Test',
        email: 'schema@example.com',
      });

      await repository.insert(entity);

      // Retrieve and verify schema validation works
      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);
    });

    it('should handle schema validation errors gracefully', async () => {
      // Manually insert invalid data to test schema validation
      await pool.query(sql.unsafe`
        INSERT INTO test_entities (id, name, email, "createdAt", "updatedAt")
        VALUES ('invalid-uuid', 'Test', 'invalid-email', NOW(), NOW())
      `);

      // Schema validation should catch the invalid UUID and email
      await expect(repository.findAll()).rejects.toThrow();
    });
  });

  describe('Connection Management', () => {
    it('should use transaction connection when available', async () => {
      const entity = TestAggregate.create({
        name: 'Connection Test',
        email: 'connection@example.com',
      });

      await repository.transaction(async () => {
        // Within transaction, should use transaction connection
        await repository.insert(entity);

        // Verify entity exists within transaction
        const found = await repository.findOneById(entity.id);
        expect(found.isSome()).toBe(true);
      });

      // Verify entity persisted after transaction
      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);
    });

    it('should fall back to pool connection when no transaction', async () => {
      const entity = TestAggregate.create({
        name: 'Pool Test',
        email: 'pool@example.com',
      });

      // Should use pool connection directly
      await repository.insert(entity);

      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);
    });
  });

  describe('Event Publishing', () => {
    it('should publish domain events after successful operations', async () => {
      const eventSpy = jest.spyOn(eventEmitter, 'emit');

      const entity = TestAggregate.create({
        name: 'Event Test',
        email: 'event@example.com',
      });

      // Add a domain event to test
      entity.addDomainEvent({
        aggregateId: entity.id,
        eventType: 'TestEntityCreated',
        payload: { name: entity.getProps().name },
      } as any);

      await repository.insert(entity);

      // Should have published the domain event
      expect(eventSpy).toHaveBeenCalled();

      eventSpy.mockRestore();
    });
  });
});

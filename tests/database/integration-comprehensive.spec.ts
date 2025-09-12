import { Test, TestingModule } from '@nestjs/testing';
import { DatabasePool, sql, createPool } from 'slonik';
import { getMigrator } from '../../database/getMigrator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { SqlRepositoryBase } from '@src/libs/db/sql-repository.base';
import { AggregateRoot, Mapper } from '@libs/ddd';
import { DatabaseMigrationService } from '@src/libs/database/database-migration.service';
import { buildTestConnectionUri } from '../utils/database-test.utils';
// import { getMigrator } from '../../database/getMigrator';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Comprehensive integration test that verifies the entire database stack:
 * - Connection management and pooling
 * - Migration system
 * - Repository pattern with base class
 * - Transaction handling
 * - Error scenarios
 * - Performance characteristics
 *
 * This test ensures that the database layer works as a cohesive system
 * and helps verify that modernization doesn't break existing functionality.
 */

// Test domain model for comprehensive testing
class ComprehensiveTestEntity extends AggregateRoot<{
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  metadata: Record<string, any>;
  tags: string[];
}> {
  protected _id: string;

  constructor(createProps: {
    id: string;
    props: {
      title: string;
      description: string;
      status: 'draft' | 'published' | 'archived';
      metadata: Record<string, any>;
      tags: string[];
    };
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    super(createProps);
  }

  validate(): void {
    if (!this.props.title?.trim()) {
      throw new Error('Title is required');
    }
    if (this.props.title.length > 500) {
      throw new Error('Title too long');
    }
    if (!['draft', 'published', 'archived'].includes(this.props.status)) {
      throw new Error('Invalid status');
    }
  }

  publish(): void {
    if (this.props.status === 'archived') {
      throw new Error('Cannot publish archived entity');
    }
    // Note: In a real implementation, this would require creating a new entity
    // with updated props, as props are readonly
    (this.props as any).status = 'published';
  }

  archive(): void {
    // Note: In a real implementation, this would require creating a new entity
    // with updated props, as props are readonly
    (this.props as any).status = 'archived';
  }

  addTag(tag: string): void {
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
    }
  }

  static create(props: {
    title: string;
    description: string;
    status?: 'draft' | 'published' | 'archived';
    metadata?: Record<string, any>;
    tags?: string[];
  }): ComprehensiveTestEntity {
    return new ComprehensiveTestEntity({
      id: 'test-id',
      props: {
        title: props.title,
        description: props.description,
        status: props.status || 'draft',
        metadata: props.metadata || {},
        tags: props.tags || [],
      },
    });
  }
}

// Schema for comprehensive testing
const comprehensiveTestSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string(),
  status: z.enum(['draft', 'published', 'archived'] as const),
  metadata: z.record(z.string(), z.any()),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type ComprehensiveTestModel = z.TypeOf<typeof comprehensiveTestSchema>;

// Mapper for comprehensive testing
class ComprehensiveTestMapper
  implements Mapper<ComprehensiveTestEntity, ComprehensiveTestModel>
{
  toPersistence(entity: ComprehensiveTestEntity): ComprehensiveTestModel {
    const props = entity.getProps();
    return {
      id: entity.id,
      title: props.title,
      description: props.description,
      status: props.status,
      metadata: props.metadata,
      tags: props.tags,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  toDomain(model: ComprehensiveTestModel): ComprehensiveTestEntity {
    return new ComprehensiveTestEntity({
      id: model.id,
      props: {
        title: model.title,
        description: model.description,
        status: model.status,
        metadata: model.metadata,
        tags: model.tags,
      },
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  toResponse(entity: ComprehensiveTestEntity): any {
    const props = entity.getProps();
    return {
      id: entity.id,
      title: props.title,
      description: props.description,
      status: props.status,
      metadata: props.metadata,
      tags: props.tags,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

// Repository for comprehensive testing
class ComprehensiveTestRepository extends SqlRepositoryBase<
  ComprehensiveTestEntity,
  ComprehensiveTestModel
> {
  protected tableName = 'comprehensive_test_entities';
  protected schema = comprehensiveTestSchema;

  constructor(
    pool: DatabasePool,
    mapper: ComprehensiveTestMapper,
    eventEmitter: EventEmitter2,
    logger: Logger,
  ) {
    super(pool, mapper, eventEmitter, logger);
  }

  async findByStatus(
    status: 'draft' | 'published' | 'archived',
  ): Promise<ComprehensiveTestEntity[]> {
    const result = await this.pool.query(
      sql.type(this.schema)`
        SELECT * FROM ${sql.identifier([this.tableName])} 
        WHERE status = ${status}
        ORDER BY "createdAt" DESC
      `,
    );

    return result.rows.map((row) => this.mapper.toDomain(row));
  }

  async findByTags(tags: string[]): Promise<ComprehensiveTestEntity[]> {
    const result = await this.pool.query(
      sql.type(this.schema)`
        SELECT * FROM ${sql.identifier([this.tableName])} 
        WHERE tags && ${sql.array(tags, 'text')}
        ORDER BY "createdAt" DESC
      `,
    );

    return result.rows.map((row) => this.mapper.toDomain(row));
  }

  async updateMetadata(entity: ComprehensiveTestEntity): Promise<void> {
    const props = entity.getProps();
    await this.pool.query(
      sql.unsafe`
        UPDATE ${sql.identifier([this.tableName])} 
        SET metadata = ${JSON.stringify(props.metadata)}, "updatedAt" = NOW()
        WHERE id = ${entity.id}
      `,
    );
  }

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgTagCount: number;
  }> {
    const result = await this.pool.query(sql.unsafe`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_count,
        AVG(array_length(tags, 1)) as avg_tag_count
      FROM ${sql.identifier([this.tableName])}
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      byStatus: {
        draft: parseInt(row.draft_count),
        published: parseInt(row.published_count),
        archived: parseInt(row.archived_count),
      },
      avgTagCount: parseFloat(row.avg_tag_count) || 0,
    };
  }
}

describe('Comprehensive Database Integration', () => {
  let pool: DatabasePool;
  let migrator: DatabaseMigrationService;
  let repository: ComprehensiveTestRepository;
  let eventEmitter: EventEmitter2;
  let logger: Logger;
  let mapper: ComprehensiveTestMapper;
  let testMigrationsPath: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventEmitter2, Logger, ComprehensiveTestMapper],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    logger = module.get<Logger>(Logger);
    mapper = module.get<ComprehensiveTestMapper>(ComprehensiveTestMapper);

    // Setup test migrations
    testMigrationsPath = path.join(__dirname, 'comprehensive-migrations');
    if (!fs.existsSync(testMigrationsPath)) {
      fs.mkdirSync(testMigrationsPath, { recursive: true });
    }

    // Create test migration
    const migrationContent = `
      CREATE TABLE comprehensive_test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
        metadata JSONB NOT NULL DEFAULT '{}',
        tags TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT valid_title_length CHECK (length(title) > 0)
      );
      
      CREATE INDEX idx_comprehensive_status ON comprehensive_test_entities(status);
      CREATE INDEX idx_comprehensive_tags ON comprehensive_test_entities USING GIN(tags);
      CREATE INDEX idx_comprehensive_created ON comprehensive_test_entities("createdAt");
    `;

    const downMigrationContent = `
      DROP TABLE IF EXISTS comprehensive_test_entities;
    `;

    fs.writeFileSync(
      path.join(
        testMigrationsPath,
        '2023.01.01T00.00.01.comprehensive_test.sql',
      ),
      migrationContent,
    );

    const downDir = path.join(testMigrationsPath, 'down');
    if (!fs.existsSync(downDir)) {
      fs.mkdirSync(downDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(downDir, '2023.01.01T00.00.01.comprehensive_test.sql'),
      downMigrationContent,
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    // Clean up test migrations
    if (fs.existsSync(testMigrationsPath)) {
      fs.rmSync(testMigrationsPath, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Create fresh instances for each test
    pool = await createPool(buildTestConnectionUri());

    const { migrator: migratorInstance } = await getMigrator();
    migrator = migratorInstance;

    // Run migrations
    await migrator.up();

    repository = new ComprehensiveTestRepository(
      pool,
      mapper,
      eventEmitter,
      logger,
    );

    // Clean up test data
    await pool.query(sql.unsafe`TRUNCATE comprehensive_test_entities`);
  });

  afterEach(async () => {
    if (migrator) {
      try {
        await migrator.down();
      } catch {
        // Ignore rollback errors
      }
    }

    if (pool) {
      await pool.end();
    }
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete CRUD lifecycle with business logic', async () => {
      // Create new entity
      const entity = ComprehensiveTestEntity.create({
        title: 'Integration Test Article',
        description: 'Testing the complete database integration',
        metadata: { author: 'test-user', priority: 'high' },
        tags: ['testing', 'integration'],
      });

      // Insert entity
      await repository.insert(entity);

      // Verify entity was created
      const found = await repository.findOneById(entity.id);
      expect(found.isSome()).toBe(true);

      const foundEntity = found.unwrap();
      expect(foundEntity.getProps().title).toBe('Integration Test Article');
      expect(foundEntity.getProps().status).toBe('draft');

      // Update entity using business logic
      foundEntity.addTag('database');
      foundEntity.publish();

      // Update in database
      await repository.updateMetadata(foundEntity);

      // Verify updates
      const updated = await repository.findOneById(entity.id);
      const updatedEntity = updated.unwrap();
      expect(updatedEntity.getProps().status).toBe('published');
      expect(updatedEntity.getProps().tags).toContain('database');

      // Query by status
      const publishedEntities = await repository.findByStatus('published');
      expect(publishedEntities).toHaveLength(1);
      expect(publishedEntities[0].id).toBe(entity.id);

      // Archive and verify
      updatedEntity.archive();
      await repository.updateMetadata(updatedEntity);

      const archivedEntities = await repository.findByStatus('archived');
      expect(archivedEntities).toHaveLength(1);

      // Delete entity
      const deleteResult = await repository.delete(updatedEntity);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const deletedCheck = await repository.findOneById(entity.id);
      expect(deletedCheck.isNone()).toBe(true);
    });

    it('should handle complex queries and aggregations', async () => {
      // Create test data set
      const entities = [
        ComprehensiveTestEntity.create({
          title: 'Tech Article 1',
          description: 'First tech article',
          status: 'published',
          tags: ['tech', 'programming'],
          metadata: { category: 'technology' },
        }),
        ComprehensiveTestEntity.create({
          title: 'Tech Article 2',
          description: 'Second tech article',
          status: 'draft',
          tags: ['tech', 'javascript'],
          metadata: { category: 'technology' },
        }),
        ComprehensiveTestEntity.create({
          title: 'Lifestyle Article',
          description: 'About lifestyle',
          status: 'published',
          tags: ['lifestyle', 'health'],
          metadata: { category: 'lifestyle' },
        }),
      ];

      // Insert all entities
      for (const entity of entities) {
        await repository.insert(entity);
      }

      // Test tag-based queries
      const techArticles = await repository.findByTags(['tech']);
      expect(techArticles).toHaveLength(2);

      const programmingArticles = await repository.findByTags(['programming']);
      expect(programmingArticles).toHaveLength(1);

      // Test statistics
      const stats = await repository.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byStatus.published).toBe(2);
      expect(stats.byStatus.draft).toBe(1);
      expect(stats.avgTagCount).toBe(2);

      // Test pagination
      const paginated = await repository.findAllPaginated({
        limit: 2,
        offset: 0,
        page: 1,
        orderBy: { field: 'createdAt', param: 'desc' },
      });
      expect(paginated.data).toHaveLength(2);
      expect(paginated.limit).toBe(2);
    });
  });

  describe('Transaction Consistency', () => {
    it('should maintain data consistency across complex transactions', async () => {
      const entities = [
        ComprehensiveTestEntity.create({
          title: 'Batch Article 1',
          description: 'First batch article',
          tags: ['batch'],
        }),
        ComprehensiveTestEntity.create({
          title: 'Batch Article 2',
          description: 'Second batch article',
          tags: ['batch'],
        }),
      ];

      await repository.transaction(async () => {
        // Insert multiple entities
        for (const entity of entities) {
          await repository.insert(entity);
        }

        // Update all entities
        for (const entity of entities) {
          entity.publish();
          await repository.updateMetadata(entity);
        }

        // Verify within transaction
        const published = await repository.findByStatus('published');
        expect(published).toHaveLength(2);
      });

      // Verify after transaction
      const allPublished = await repository.findByStatus('published');
      expect(allPublished).toHaveLength(2);

      const allEntities = await repository.findAll();
      expect(allEntities).toHaveLength(2);
    });

    it('should rollback complex operations on error', async () => {
      const entity1 = ComprehensiveTestEntity.create({
        title: 'Transaction Test 1',
        description: 'First transaction test',
      });

      const entity2 = ComprehensiveTestEntity.create({
        title: 'Transaction Test 2',
        description: 'Second transaction test',
      });

      try {
        await repository.transaction(async () => {
          await repository.insert(entity1);
          await repository.insert(entity2);

          // Update first entity
          entity1.publish();
          await repository.updateMetadata(entity1);

          // Force an error
          throw new Error('Forced transaction rollback');
        });
      } catch (error) {
        expect((error as Error).message).toBe('Forced transaction rollback');
      }

      // Verify complete rollback
      const allEntities = await repository.findAll();
      expect(allEntities).toHaveLength(0);

      const stats = await repository.getStatistics();
      expect(stats.total).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderate data volumes efficiently', async () => {
      const entityCount = 50;
      const entities: ComprehensiveTestEntity[] = [];

      // Create test data
      for (let i = 0; i < entityCount; i++) {
        entities.push(
          ComprehensiveTestEntity.create({
            title: `Performance Test Article ${i + 1}`,
            description: `Testing performance with article number ${i + 1}`,
            status:
              i % 3 === 0 ? 'published' : i % 3 === 1 ? 'draft' : 'archived',
            tags: [`tag-${i % 5}`, `category-${i % 3}`],
            metadata: { index: i, batch: Math.floor(i / 10) },
          }),
        );
      }

      // Measure insertion time
      const insertStart = Date.now();

      for (const entity of entities) {
        await repository.insert(entity);
      }

      const insertTime = Date.now() - insertStart;
      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Measure query time
      const queryStart = Date.now();

      const allEntities = await repository.findAll();
      const publishedEntities = await repository.findByStatus('published');
      const taggedEntities = await repository.findByTags(['tag-0']);
      const stats = await repository.getStatistics();

      const queryTime = Date.now() - queryStart;
      expect(queryTime).toBeLessThan(1000); // Queries should be fast

      // Verify data integrity
      expect(allEntities).toHaveLength(entityCount);
      expect(publishedEntities.length).toBeGreaterThan(0);
      expect(taggedEntities.length).toBeGreaterThan(0);
      expect(stats.total).toBe(entityCount);
    });

    it('should handle concurrent operations safely', async () => {
      const concurrentOperations = 10;
      const operations: Promise<any>[] = [];

      // Create concurrent insert operations
      for (let i = 0; i < concurrentOperations; i++) {
        const entity = ComprehensiveTestEntity.create({
          title: `Concurrent Article ${i + 1}`,
          description: `Testing concurrent operations ${i + 1}`,
          tags: [`concurrent-${i}`],
        });

        operations.push(repository.insert(entity));
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);

      // All operations should succeed
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful).toHaveLength(concurrentOperations);

      // Verify all entities were inserted
      const allEntities = await repository.findAll();
      expect(allEntities).toHaveLength(concurrentOperations);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from constraint violations', async () => {
      const entity1 = ComprehensiveTestEntity.create({
        title: 'Original Article',
        description: 'First article',
        tags: ['unique'],
      });

      await repository.insert(entity1);

      // Try to insert entity with same ID (should fail)
      const entity2 = new ComprehensiveTestEntity({
        id: entity1.id, // Same ID should cause conflict
        props: {
          title: 'Duplicate Article',
          description: 'Duplicate article',
          status: 'draft',
          metadata: {},
          tags: ['duplicate'],
        },
      });

      await expect(repository.insert(entity2)).rejects.toThrow();

      // Original entity should still exist
      const found = await repository.findOneById(entity1.id);
      expect(found.isSome()).toBe(true);
      expect(found.unwrap().getProps().title).toBe('Original Article');

      // System should still be functional
      const newEntity = ComprehensiveTestEntity.create({
        title: 'New Article',
        description: 'After error recovery',
        tags: ['recovery'],
      });

      await repository.insert(newEntity);
      const allEntities = await repository.findAll();
      expect(allEntities).toHaveLength(2);
    });

    it('should handle migration rollback scenarios', async () => {
      // Verify table exists after migration
      const tableCheck = await pool.query(sql.unsafe`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'comprehensive_test_entities'
      `);
      expect(tableCheck.rowCount).toBe(1);

      // Insert test data
      const entity = ComprehensiveTestEntity.create({
        title: 'Pre-rollback Article',
        description: 'Article before rollback',
      });
      await repository.insert(entity);

      // Rollback migration
      await migrator.down();

      // Table should be dropped
      const tableAfterRollback = await pool.query(sql.unsafe`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'comprehensive_test_entities'
      `);
      expect(tableAfterRollback.rowCount).toBe(0);

      // Re-run migration
      await migrator.up();

      // Table should exist again (but empty)
      const tableAfterRerun = await pool.query(sql.unsafe`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'comprehensive_test_entities'
      `);
      expect(tableAfterRerun.rowCount).toBe(1);

      const count = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM comprehensive_test_entities
      `);
      expect(count.rows[0].count).toBe(0);
    });
  });

  describe('Schema Evolution Compatibility', () => {
    it('should handle schema validation edge cases', async () => {
      // Insert valid data
      const entity = ComprehensiveTestEntity.create({
        title: 'Schema Test',
        description: 'Testing schema validation',
        metadata: {
          nested: { deep: { value: 'test' } },
          array: [1, 2, 3],
          null_value: null,
        },
        tags: ['schema', 'validation', 'edge-case'],
      });

      await repository.insert(entity);

      // Query with schema validation
      const result = await pool.query(
        sql.type(comprehensiveTestSchema)`
          SELECT * FROM comprehensive_test_entities WHERE id = ${entity.id}
        `,
      );

      expect(result.rowCount).toBe(1);

      const row = result.rows[0];
      expect((row.metadata as any).nested.deep.value).toBe('test');
      expect(row.metadata.array).toEqual([1, 2, 3]);
      expect(row.tags).toEqual(['schema', 'validation', 'edge-case']);
    });
  });
});

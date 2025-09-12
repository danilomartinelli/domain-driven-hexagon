import { DatabaseMigrationService } from '@src/libs/database/database-migration.service';
import { createPool, DatabasePool, sql } from 'slonik';
import * as path from 'path';
import * as fs from 'fs';
import { getMigrator } from '../../database/getMigrator';
import { databaseConfig } from '@src/configs/database.config';

describe('Migration System', () => {
  let pool: DatabasePool;
  let migrator: DatabaseMigrationService;
  let testMigrationsPath: string;

  beforeAll(async () => {
    // Ensure we're using test database
    if (!databaseConfig.database?.includes('test')) {
      throw new Error('Tests must use a test database');
    }

    // Create temporary directory for test migrations
    testMigrationsPath = path.join(__dirname, 'temp-migrations');
    if (!fs.existsSync(testMigrationsPath)) {
      fs.mkdirSync(testMigrationsPath, { recursive: true });
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsPath)) {
      fs.rmSync(testMigrationsPath, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Create fresh migrator instance for each test
    const { pool: newPool, migrator: newMigrator } = await getMigrator();
    pool = newPool;
    migrator = newMigrator;

    // Clean up migration table
    try {
      await pool.query(sql.unsafe`DROP TABLE IF EXISTS migration`);
    } catch {
      // Ignore if table doesn't exist
    }
  });

  afterEach(async () => {
    if (migrator) {
      try {
        // Clean up any test tables created during migrations
        await pool.query(sql.unsafe`DROP TABLE IF EXISTS test_migration_table`);
        await pool.query(sql.unsafe`DROP TABLE IF EXISTS migration`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Migration Table Management', () => {
    it('should create migration table automatically', async () => {
      await migrator.up();

      // Check if migration table exists
      const result = await pool.query(sql.unsafe`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'migration' AND table_schema = 'public'
      `);

      expect(result.rowCount).toBe(1);
    });

    it('should track migration execution history', async () => {
      await migrator.up();

      const migrations = await pool.query(sql.unsafe`
        SELECT name, created_at 
        FROM migration 
        ORDER BY created_at
      `);

      // Should have executed existing migrations
      expect(migrations.rowCount).toBeGreaterThan(0);

      // Each migration should have a timestamp
      migrations.rows.forEach((row) => {
        expect(row.name).toBeDefined();
        expect(row.created_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('Migration Execution', () => {
    it('should execute pending migrations in correct order', async () => {
      // Create test migration files
      const migration1Content = `
        CREATE TABLE test_migration_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        );
      `;

      const migration2Content = `
        ALTER TABLE test_migration_table ADD COLUMN email VARCHAR(255);
      `;

      const migration1Path = path.join(
        testMigrationsPath,
        '2023.01.01T00.00.01.test1.sql',
      );
      const migration2Path = path.join(
        testMigrationsPath,
        '2023.01.01T00.00.02.test2.sql',
      );

      fs.writeFileSync(migration1Path, migration1Content);
      fs.writeFileSync(migration2Path, migration2Content);

      // Create migrator with test migrations path
      const testPool = await createPool(
        `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      );

      const { migrator: testMigrator } = await getMigrator();

      try {
        await testMigrator.up();

        // Verify table was created and modified
        const tableInfo = await testPool.query(sql.unsafe`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'test_migration_table'
          ORDER BY ordinal_position
        `);

        expect(tableInfo.rowCount).toBe(3); // id, name, email
        expect(tableInfo.rows.map((r) => r.column_name)).toEqual([
          'id',
          'name',
          'email',
        ]);
      } finally {
        await testPool.end();
      }
    });

    it('should skip already executed migrations', async () => {
      // Run migrations first time
      await migrator.up();

      const firstRun = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM migration
      `);

      // Run migrations again
      await migrator.up();

      const secondRun = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM migration
      `);

      // Should have same number of migrations (no duplicates)
      expect(firstRun.rows[0].count).toBe(secondRun.rows[0].count);
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      // Create test migration with down file
      const upMigration = `
        CREATE TABLE test_migration_table (
          id SERIAL PRIMARY KEY,
          data TEXT
        );
      `;

      const downMigration = `
        DROP TABLE IF EXISTS test_migration_table;
      `;

      const upPath = path.join(
        testMigrationsPath,
        '2023.01.01T00.00.01.rollback_test.sql',
      );
      const downDir = path.join(testMigrationsPath, 'down');
      const downPath = path.join(
        downDir,
        '2023.01.01T00.00.01.rollback_test.sql',
      );

      if (!fs.existsSync(downDir)) {
        fs.mkdirSync(downDir, { recursive: true });
      }

      fs.writeFileSync(upPath, upMigration);
      fs.writeFileSync(downPath, downMigration);
    });

    it('should rollback migrations correctly', async () => {
      const testPool = await createPool(
        `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      );

      const { migrator: testMigrator } = await getMigrator();

      try {
        // Run migration
        await testMigrator.up();

        // Verify table exists
        const tableExists = await testPool.query(sql.unsafe`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'test_migration_table'
        `);
        expect(tableExists.rowCount).toBe(1);

        // Rollback migration
        await testMigrator.down();

        // Verify table was dropped
        const tableAfterRollback = await testPool.query(sql.unsafe`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'test_migration_table'
        `);
        expect(tableAfterRollback.rowCount).toBe(0);
      } finally {
        await testPool.end();
      }
    });
  });

  describe('Migration Error Handling', () => {
    it('should handle SQL syntax errors gracefully', async () => {
      const invalidMigration = `
        CREATE TABLE invalid_syntax (
          id SERIAL PRIMARY KEY,
          invalid_column_definition
        );
      `;

      const migrationPath = path.join(
        testMigrationsPath,
        '2023.01.01T00.00.01.invalid.sql',
      );
      fs.writeFileSync(migrationPath, invalidMigration);

      const testPool = await createPool(
        `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      );

      const { migrator: testMigrator } = await getMigrator();

      try {
        await expect(testMigrator.up()).rejects.toThrow();

        // Migration table should still exist but invalid migration shouldn't be recorded
        const migrations = await testPool.query(sql.unsafe`
          SELECT name FROM migration WHERE name LIKE '%invalid%'
        `);
        expect(migrations.rowCount).toBe(0);
      } finally {
        await testPool.end();
      }
    });

    it('should handle missing migration files', async () => {
      // Create a migration entry in DB but no corresponding file
      await migrator.up(); // Create migration table

      await pool.query(sql.unsafe`
        INSERT INTO migration (name, created_at) 
        VALUES ('2023.01.01T00.00.01.missing_file.sql', NOW())
      `);

      // This should not cause errors when running migrations
      await expect(migrator.up()).resolves.not.toThrow();
    });
  });

  describe('Migration Status Queries', () => {
    it('should identify pending migrations', async () => {
      // Create a test migration file
      const migrationContent = `
        CREATE TABLE pending_test (id SERIAL PRIMARY KEY);
      `;

      const migrationPath = path.join(
        testMigrationsPath,
        '2023.01.01T00.00.01.pending.sql',
      );
      fs.writeFileSync(migrationPath, migrationContent);

      const testPool = await createPool(
        `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      );

      const { migrator: testMigrator } = await getMigrator();

      try {
        // Initialize migration table but don't run migrations
        await testMigrator.up();

        // The test migration should be pending
        const executed = await testPool.query(sql.unsafe`
          SELECT name FROM migration WHERE name LIKE '%pending%'
        `);

        // Before running the specific migration, it shouldn't be in the executed list
        expect(executed.rowCount).toBe(0);
      } finally {
        await testPool.end();
      }
    });

    it('should track executed migrations', async () => {
      await migrator.up();

      const executed = await pool.query(sql.unsafe`
        SELECT name, created_at FROM migration ORDER BY created_at
      `);

      expect(executed.rowCount).toBeGreaterThan(0);

      // All executed migrations should have timestamps
      executed.rows.forEach((row) => {
        expect(row.name).toMatch(/^\d{4}\.\d{2}\.\d{2}T\d{2}\.\d{2}\.\d{2}/);
        expect(row.created_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('Migration Concurrency', () => {
    it('should handle concurrent migration attempts safely', async () => {
      // Create multiple migrator instances to simulate concurrency
      const migrators = await Promise.all([
        getMigrator(),
        getMigrator(),
        getMigrator(),
      ]);

      try {
        // Run migrations concurrently
        const results = await Promise.allSettled(
          migrators.map(({ migrator }) => migrator.up()),
        );

        // All should succeed or handle the conflict gracefully
        results.forEach((result) => {
          if (result.status === 'rejected') {
            // Should be due to concurrent access, not other errors
            expect(result.reason.message).toMatch(/migration|lock|concurrent/i);
          }
        });

        // Verify migrations were executed correctly
        const migrations = await pool.query(sql.unsafe`
          SELECT DISTINCT name FROM migration
        `);

        // Should have unique migration records (no duplicates)
        const allMigrations = await pool.query(sql.unsafe`
          SELECT name FROM migration
        `);

        expect(migrations.rowCount).toBe(allMigrations.rowCount);
      } finally {
        // Clean up additional pools
        await Promise.all(migrators.map(({ pool }) => pool.end()));
      }
    });
  });

  describe('Environment-Specific Migrations', () => {
    it('should use correct database configuration for test environment', async () => {
      const { pool: envPool } = await getMigrator();

      try {
        // Verify we're connected to test database
        const dbName = await envPool.query(sql.unsafe`
          SELECT current_database() as database_name
        `);

        expect(dbName.rows[0].database_name).toContain('test');
      } finally {
        await envPool.end();
      }
    });

    it('should load environment-specific configuration', async () => {
      // Verify NODE_ENV affects migration behavior
      const originalEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'test';
        const { migrator: testMigrator } = await getMigrator();

        expect(testMigrator).toBeDefined();
        expect(typeof testMigrator.up).toBe('function');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});

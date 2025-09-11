import { Injectable, Logger, Inject } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { readdir, readFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { z } from 'zod';
import { createHash } from 'crypto';
import { DATABASE_POOL_TOKEN } from './database.constants';
import { DatabaseConfigService } from './database-config.service';
import { MigrationStatus } from './database.interfaces';

/**
 * Migration file metadata type
 */
type MigrationFile = {
  name: string;
  timestamp: string;
  content: string;
  checksum: string;
  filePath: string;
};

/**
 * Schema for migration table record
 */
const MigrationRecordSchema = z.object({
  id: z.number(),
  name: z.string(),
  executed_at: z.date(),
  checksum: z.string(),
});

type MigrationRecord = z.infer<typeof MigrationRecordSchema>;

/**
 * Custom migration service that replaces @slonik/migrator
 * Provides type-safe, reliable database migration management
 */
@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(
    @Inject(DATABASE_POOL_TOKEN)
    private readonly pool: DatabasePool,
    private readonly configService: DatabaseConfigService,
  ) {}

  /**
   * Run all pending migrations
   */
  async up(): Promise<MigrationStatus[]> {
    this.logger.log('Starting migration process...');

    try {
      await this.ensureMigrationTableExists();

      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        this.logger.log('No pending migrations found');
        return [];
      }

      this.logger.log(`Found ${pendingMigrations.length} pending migrations`);

      const results: MigrationStatus[] = [];

      for (const migration of pendingMigrations) {
        try {
          await this.executeMigration(migration);
          results.push({
            name: migration.name,
            executed: true,
            executedAt: new Date(),
            checksum: migration.checksum,
          });
          this.logger.log(`Successfully executed migration: ${migration.name}`);
        } catch (error) {
          this.logger.error(
            `Failed to execute migration: ${migration.name}`,
            error instanceof Error ? error.stack : undefined,
          );
          results.push({
            name: migration.name,
            executed: false,
          });
          throw error; // Stop execution on first failure
        }
      }

      this.logger.log(
        `Successfully executed ${results.filter((r) => r.executed).length} migrations`,
      );
      return results;
    } catch (error) {
      this.logger.error('Migration process failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Rollback the last executed migration
   */
  async down(): Promise<MigrationStatus | null> {
    this.logger.log('Starting rollback process...');

    try {
      await this.ensureMigrationTableExists();

      const lastMigration = await this.getLastExecutedMigration();

      if (!lastMigration) {
        this.logger.log('No migrations to rollback');
        return null;
      }

      this.logger.log(`Rolling back migration: ${lastMigration.name}`);

      const migrationFile = await this.findMigrationFile(lastMigration.name);
      if (!migrationFile) {
        throw new Error(`Migration file not found for: ${lastMigration.name}`);
      }

      await this.rollbackMigration(migrationFile, lastMigration);

      this.logger.log(
        `Successfully rolled back migration: ${lastMigration.name}`,
      );

      return {
        name: lastMigration.name,
        executed: false,
        checksum: lastMigration.checksum,
      };
    } catch (error) {
      this.logger.error('Rollback process failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get list of all migrations with their execution status
   */
  async status(): Promise<MigrationStatus[]> {
    try {
      await this.ensureMigrationTableExists();

      const allMigrations = await this.loadMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();

      const executedMap = new Map(executedMigrations.map((m) => [m.name, m]));

      return allMigrations.map((migration) => {
        const executed = executedMap.get(migration.name);
        return {
          name: migration.name,
          executed: !!executed,
          executedAt: executed?.executed_at,
          checksum: migration.checksum,
        };
      });
    } catch (error) {
      this.logger.error('Failed to get migration status', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations(): Promise<MigrationFile[]> {
    const allMigrations = await this.loadMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    const executedNames = new Set(executedMigrations.map((m) => m.name));

    return allMigrations.filter(
      (migration) => !executedNames.has(migration.name),
    );
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    if (!name || name.trim().length === 0) {
      throw new Error('Migration name is required');
    }

    // Sanitize migration name
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .split('.')[0];
    const fileName = `${timestamp}_${sanitizedName}.sql`;
    const filePath = join(this.getMigrationsPath(), fileName);

    const template = this.generateMigrationTemplate();

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, template, 'utf8');

      this.logger.log(`Created migration file: ${fileName}`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `Failed to create migration file: ${fileName}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Validate migration files for consistency
   */
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const migrationFiles = await this.loadMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();

      // Check for checksum mismatches
      for (const executed of executedMigrations) {
        const file = migrationFiles.find((f) => f.name === executed.name);
        if (file && file.checksum !== executed.checksum) {
          errors.push(`Checksum mismatch for migration: ${executed.name}`);
        }
      }

      // Check for duplicate names
      const names = migrationFiles.map((f) => f.name);
      const duplicates = names.filter(
        (name, index) => names.indexOf(name) !== index,
      );
      for (const duplicate of duplicates) {
        errors.push(`Duplicate migration name: ${duplicate}`);
      }

      // Check file naming convention
      for (const file of migrationFiles) {
        if (!/^\d{14}_\w+\.sql$/.test(basename(file.filePath))) {
          errors.push(
            `Invalid migration filename format: ${basename(file.filePath)}`,
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Validation failed: ${errorMessage}`);
      return {
        valid: false,
        errors,
      };
    }
  }

  /**
   * Load all migration files from the migrations directory
   */
  private async loadMigrationFiles(): Promise<MigrationFile[]> {
    const migrationsPath = this.getMigrationsPath();

    try {
      const files = await readdir(migrationsPath);
      const sqlFiles = files.filter((file) => extname(file) === '.sql');

      const migrations: MigrationFile[] = [];

      for (const file of sqlFiles) {
        const filePath = join(migrationsPath, file);
        const content = await readFile(filePath, 'utf8');
        const checksum = this.calculateChecksum(content);
        const name = basename(file, '.sql');
        const timestamp = name.split('_')[0];

        migrations.push({
          name,
          timestamp,
          content,
          checksum,
          filePath,
        });
      }

      // Sort by timestamp
      return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        this.logger.warn(`Migrations directory not found: ${migrationsPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const tableName = this.configService.config.migrationTableName;

    try {
      const result = await this.pool.many(sql.unsafe`
        SELECT id, name, executed_at, checksum 
        FROM ${sql.identifier([tableName])} 
        ORDER BY executed_at ASC
      `);

      return result.map((row) => MigrationRecordSchema.parse(row));
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get the last executed migration
   */
  private async getLastExecutedMigration(): Promise<MigrationRecord | null> {
    const tableName = this.configService.config.migrationTableName;

    try {
      const result = await this.pool.maybeOne(sql.unsafe`
        SELECT id, name, executed_at, checksum 
        FROM ${sql.identifier([tableName])} 
        ORDER BY executed_at DESC 
        LIMIT 1
      `);

      return result ? MigrationRecordSchema.parse(result) : null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find migration file by name
   */
  private async findMigrationFile(name: string): Promise<MigrationFile | null> {
    const migrations = await this.loadMigrationFiles();
    return migrations.find((m) => m.name === name) || null;
  }

  /**
   * Execute a migration within a transaction
   */
  private async executeMigration(migration: MigrationFile): Promise<void> {
    const tableName = this.configService.config.migrationTableName;

    await this.pool.transaction(async (connection) => {
      // Parse migration content for UP and DOWN sections
      const { upContent } = this.parseMigrationContent(migration.content);

      // Execute UP migration
      if (upContent.trim()) {
        await connection.query(sql.unsafe`${upContent}`);
      }

      // Record migration as executed
      await connection.query(sql.unsafe`
        INSERT INTO ${sql.identifier([tableName])} (name, executed_at, checksum)
        VALUES (${migration.name}, ${sql.timestamp(new Date())}, ${migration.checksum})
      `);
    });
  }

  /**
   * Rollback a migration within a transaction
   */
  private async rollbackMigration(
    migration: MigrationFile,
    record: MigrationRecord,
  ): Promise<void> {
    const tableName = this.configService.config.migrationTableName;

    await this.pool.transaction(async (connection) => {
      // Parse migration content for UP and DOWN sections
      const { downContent } = this.parseMigrationContent(migration.content);

      if (!downContent.trim()) {
        throw new Error(`No DOWN migration found for: ${migration.name}`);
      }

      // Execute DOWN migration
      await connection.query(sql.unsafe`${downContent}`);

      // Remove migration record
      await connection.query(sql.unsafe`
        DELETE FROM ${sql.identifier([tableName])} 
        WHERE id = ${record.id}
      `);
    });
  }

  /**
   * Ensure migration table exists
   */
  private async ensureMigrationTableExists(): Promise<void> {
    const tableName = this.configService.config.migrationTableName;

    await this.pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS ${sql.identifier([tableName])} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      )
    `);

    // Create index on executed_at for performance
    await this.pool.query(sql.unsafe`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_executed_at 
      ON ${sql.identifier([tableName])} (executed_at)
    `);
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Parse migration content to extract UP and DOWN sections
   */
  private parseMigrationContent(content: string): {
    upContent: string;
    downContent: string;
  } {
    const lines = content.split('\n');
    let upContent = '';
    let downContent = '';
    let currentSection: 'up' | 'down' | 'none' = 'up'; // Default to up section

    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();

      if (
        trimmedLine.startsWith('-- +migrate up') ||
        trimmedLine.startsWith('-- up')
      ) {
        currentSection = 'up';
        continue;
      }

      if (
        trimmedLine.startsWith('-- +migrate down') ||
        trimmedLine.startsWith('-- down')
      ) {
        currentSection = 'down';
        continue;
      }

      if (currentSection === 'up') {
        upContent += line + '\n';
      } else if (currentSection === 'down') {
        downContent += line + '\n';
      }
    }

    return {
      upContent: upContent.trim(),
      downContent: downContent.trim(),
    };
  }

  /**
   * Generate migration template
   */
  private generateMigrationTemplate(): string {
    return `-- +migrate Up
-- SQL for applying this migration goes here
-- Example: CREATE TABLE example (...);

-- +migrate Down  
-- SQL for rolling back this migration goes here
-- Example: DROP TABLE example;
`;
  }

  /**
   * Get migrations directory path
   */
  private getMigrationsPath(): string {
    return this.configService.config.migrationsPath;
  }
}

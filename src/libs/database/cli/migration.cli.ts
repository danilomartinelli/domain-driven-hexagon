#!/usr/bin/env ts-node

import { Command } from 'commander';
import { createPool } from 'slonik';
import { config } from 'dotenv';
import { DatabaseMigrationService } from '../database-migration.service';
import { DatabaseConfigService } from '../database-config.service';

/**
 * CLI tool for database migrations
 * Provides commands for running, rolling back, and managing database migrations
 */
class MigrationCLI {
  private migrationService: DatabaseMigrationService;
  private pool: any;

  constructor() {
    this.setupEnvironment();
  }

  /**
   * Setup environment and configuration
   */
  private setupEnvironment(): void {
    // Load environment variables
    const envPath = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
    config({ path: envPath });
  }

  /**
   * Initialize database connection and migration service
   */
  private async initialize(): Promise<void> {
    try {
      // Create database configuration
      const databaseOptions = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true',
        migrationsPath:
          process.env.DB_MIGRATIONS_PATH || './database/migrations',
        migrationTableName: process.env.DB_MIGRATION_TABLE || 'migration',
      };

      // Create database pool
      const connectionUri = `postgres://${databaseOptions.username}:${databaseOptions.password}@${databaseOptions.host}:${databaseOptions.port}/${databaseOptions.database}`;
      this.pool = await createPool(connectionUri);

      // Create mock config service
      const configService = {
        config: {
          ...databaseOptions,
          maximumPoolSize: 20,
          minimumPoolSize: 5,
          logLevel: 'info' as const,
          enableQueryLogging: false,
        },
      } as DatabaseConfigService;

      // Initialize migration service
      this.migrationService = new (DatabaseMigrationService as any)(
        this.pool,
        configService,
      );

      console.log('Database connection initialized successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize database connection:', errorMessage);
      process.exit(1);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        console.log('Database connection closed');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Error closing database connection:', errorMessage);
      }
    }
  }

  /**
   * Run all pending migrations
   */
  async up(): Promise<void> {
    console.log('Running pending migrations...');

    try {
      const results = await this.migrationService.up();

      if (results.length === 0) {
        console.log('✅ No pending migrations found');
      } else {
        console.log(`✅ Successfully executed ${results.length} migrations:`);
        results.forEach((result) => {
          console.log(`  - ${result.name}`);
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Migration failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  async down(): Promise<void> {
    console.log('Rolling back last migration...');

    try {
      const result = await this.migrationService.down();

      if (!result) {
        console.log('✅ No migrations to rollback');
      } else {
        console.log(`✅ Successfully rolled back migration: ${result.name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Rollback failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    console.log('Migration status:');

    try {
      const migrations = await this.migrationService.status();

      if (migrations.length === 0) {
        console.log('No migrations found');
        return;
      }

      console.log('\nMigrations:');
      console.log('Status   | Name                 | Executed At');
      console.log('---------|----------------------|-------------------');

      migrations.forEach((migration) => {
        const status = migration.executed ? '✅ UP  ' : '⏳ DOWN';
        const executedAt = migration.executedAt
          ? migration.executedAt.toISOString().split('T')[0]
          : 'N/A';
        console.log(
          `${status}  | ${migration.name.padEnd(20)} | ${executedAt}`,
        );
      });

      const pendingCount = migrations.filter((m) => !m.executed).length;
      console.log(`\n📊 Total: ${migrations.length}, Pending: ${pendingCount}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to get migration status:', errorMessage);
      throw error;
    }
  }

  /**
   * Create a new migration file
   */
  async create(name: string): Promise<void> {
    if (!name) {
      console.error('❌ Migration name is required');
      process.exit(1);
    }

    console.log(`Creating new migration: ${name}`);

    try {
      const filePath = await this.migrationService.createMigration(name);
      console.log(`✅ Created migration file: ${filePath}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to create migration:', errorMessage);
      throw error;
    }
  }

  /**
   * Validate migration files
   */
  async validate(): Promise<void> {
    console.log('Validating migration files...');

    try {
      const validation = await this.migrationService.validateMigrations();

      if (validation.valid) {
        console.log('✅ All migration files are valid');
      } else {
        console.log('❌ Migration validation failed:');
        validation.errors.forEach((error) => {
          console.log(`  - ${error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Validation failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Show pending migrations
   */
  async pending(): Promise<void> {
    console.log('Pending migrations:');

    try {
      const pending = await this.migrationService.getPendingMigrations();

      if (pending.length === 0) {
        console.log('✅ No pending migrations');
      } else {
        console.log(`Found ${pending.length} pending migrations:`);
        pending.forEach((migration) => {
          console.log(`  - ${migration.name}`);
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to get pending migrations:', errorMessage);
      throw error;
    }
  }

  /**
   * Setup CLI commands
   */
  setupCommands(): Command {
    const program = new Command();

    program
      .name('migrate')
      .description('Database migration tool')
      .version('1.0.0');

    program
      .command('up')
      .description('Run all pending migrations')
      .action(async () => {
        await this.initialize();
        try {
          await this.up();
        } finally {
          await this.cleanup();
        }
      });

    program
      .command('down')
      .description('Rollback the last migration')
      .action(async () => {
        await this.initialize();
        try {
          await this.down();
        } finally {
          await this.cleanup();
        }
      });

    program
      .command('status')
      .description('Show migration status')
      .action(async () => {
        await this.initialize();
        try {
          await this.status();
        } finally {
          await this.cleanup();
        }
      });

    program
      .command('create <name>')
      .description('Create a new migration file')
      .action(async (name: string) => {
        await this.initialize();
        try {
          await this.create(name);
        } finally {
          await this.cleanup();
        }
      });

    program
      .command('validate')
      .description('Validate migration files')
      .action(async () => {
        await this.initialize();
        try {
          await this.validate();
        } finally {
          await this.cleanup();
        }
      });

    program
      .command('pending')
      .description('Show pending migrations')
      .action(async () => {
        await this.initialize();
        try {
          await this.pending();
        } finally {
          await this.cleanup();
        }
      });

    return program;
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new MigrationCLI();
  const program = cli.setupCommands();

  program.parse(process.argv);
}

export { MigrationCLI };

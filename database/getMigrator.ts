/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { createPool } from 'slonik';
import { DatabaseMigrationService } from '../src/libs/database/database-migration.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// use .env or .env.test depending on NODE_ENV variable
const envPath = path.resolve(
  __dirname,
  process.env.NODE_ENV === 'test' ? '../.env.test' : '../.env',
);
dotenv.config({ path: envPath });

export async function getMigrator() {
  const pool = await createPool(
    `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  );

  // Create mock config service for migrations
  const configService = {
    config: {
      migrationsPath: path.resolve(__dirname, 'migrations'),
      migrationTableName: 'migration'
    }
  } as any;

  const migrator = new DatabaseMigrationService(pool, configService);

  return { pool, migrator };
}

// Legacy export for backward compatibility
export const SlonikMigrator = DatabaseMigrationService;

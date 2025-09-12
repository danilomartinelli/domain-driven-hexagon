import { DatabaseConfigService } from '@libs/database/database-config.service';
import { getDatabaseConfig } from '@src/configs/database.config';

/**
 * Utility function to get the database connection URI for tests.
 *
 * @returns Promise<string> The database connection URI
 */
export async function getTestDatabaseConnectionUri(): Promise<string> {
  const config = getDatabaseConfig();

  // Create a temporary config service instance for tests
  const configService = new DatabaseConfigService(config);
  await configService.onModuleInit();

  return configService.connectionUri;
}

/**
 * Synchronous utility to build database connection URI from environment variables.
 * Use this for simple test cases that don't need the full config service.
 *
 * @returns string The database connection URI
 */
export function buildTestConnectionUri(): string {
  const config = getDatabaseConfig();

  // Use secure encoding for credentials
  const encodedUsername = encodeURIComponent(config.username || '');
  const encodedPassword = encodeURIComponent(config.password || '');
  const encodedDatabase = encodeURIComponent(config.database || '');

  let uri = `postgres://${encodedUsername}:${encodedPassword}@${config.host}:${config.port}/${encodedDatabase}`;

  // Add SSL parameters if needed
  if (config.ssl) {
    uri += '?sslmode=require';
    if (!config.sslRejectUnauthorized) {
      uri += '&sslcert=disable';
    }
  }

  return uri;
}

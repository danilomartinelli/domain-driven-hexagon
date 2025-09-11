import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
// import { ModuleRef } from '@nestjs/core';
// import { DatabasePool } from 'slonik';
import { DatabaseService } from './database.service';
import { DatabaseConfigService } from './database-config.service';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseConnectionFactory } from './database-connection.factory';
import {
  DATABASE_POOL_TOKEN,
  DATABASE_CONFIG_TOKEN,
  DATABASE_MODULE_OPTIONS_TOKEN,
} from './database.constants';
import {
  DatabaseModuleOptions,
  DatabaseModuleAsyncOptions,
} from './database.interfaces';

/**
 * Global database module that provides Slonik connection pool
 * and database-related services for the entire application.
 *
 * Features:
 * - Connection pooling with configurable settings
 * - Health checks and monitoring
 * - Transaction management
 * - Migration support
 * - Type-safe database operations
 */
@Global()
@Module({})
export class DatabaseModule {
  /**
   * Register database module with synchronous configuration
   */
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const configProvider: Provider = {
      provide: DATABASE_CONFIG_TOKEN,
      useValue: options,
    };

    const poolProvider: Provider = {
      provide: DATABASE_POOL_TOKEN,
      useFactory: async (configService: DatabaseConfigService) => {
        const factory = new DatabaseConnectionFactory(configService);
        return factory.createPool();
      },
      inject: [DatabaseConfigService],
    };

    return {
      module: DatabaseModule,
      providers: [
        configProvider,
        DatabaseConfigService,
        poolProvider,
        DatabaseService,
        DatabaseMigrationService,
        DatabaseConnectionFactory,
      ],
      exports: [
        DATABASE_POOL_TOKEN,
        DatabaseService,
        DatabaseMigrationService,
        DatabaseConfigService,
      ],
    };
  }

  /**
   * Register database module with asynchronous configuration
   */
  static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    const poolProvider: Provider = {
      provide: DATABASE_POOL_TOKEN,
      useFactory: async (configService: DatabaseConfigService) => {
        const factory = new DatabaseConnectionFactory(configService);
        return factory.createPool();
      },
      inject: [DatabaseConfigService],
    };

    return {
      module: DatabaseModule,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        DatabaseConfigService,
        poolProvider,
        DatabaseService,
        DatabaseMigrationService,
        DatabaseConnectionFactory,
      ],
      exports: [
        DATABASE_POOL_TOKEN,
        DatabaseService,
        DatabaseMigrationService,
        DatabaseConfigService,
      ],
    };
  }

  private static createAsyncProviders(
    options: DatabaseModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    throw new Error(
      'Invalid DatabaseModuleAsyncOptions: must provide useFactory, useClass, or useExisting',
    );
  }

  private static createAsyncOptionsProvider(
    options: DatabaseModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: DATABASE_MODULE_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useExisting) {
      return {
        provide: DATABASE_MODULE_OPTIONS_TOKEN,
        useExisting: options.useExisting,
      };
    }

    if (options.useClass) {
      return {
        provide: DATABASE_MODULE_OPTIONS_TOKEN,
        useClass: options.useClass,
      };
    }

    throw new Error(
      'Invalid DatabaseModuleAsyncOptions: must provide useFactory, useClass, or useExisting',
    );
  }

  /**
   * Called when the module is being destroyed
   * Ensures proper cleanup of database connections
   */
  async onModuleDestroy(): Promise<void> {
    // Connection cleanup is handled by DatabaseService
  }
}

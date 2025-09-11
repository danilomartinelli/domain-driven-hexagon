import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseConfigService } from './database-config.service';
import { DATABASE_POOL_TOKEN } from './database.constants';
import { DatabasePool } from 'slonik';
import * as fs from 'fs/promises';
// import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DatabaseMigrationService', () => {
  let service: DatabaseMigrationService;
  let mockPool: Partial<DatabasePool>;
  let mockConfigService: Partial<DatabaseConfigService>;

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      transaction: jest.fn(),
      many: jest.fn(),
      maybeOne: jest.fn(),
    };

    mockConfigService = {
      config: {
        migrationTableName: 'migration',
        migrationsPath: './database/migrations',
        maximumPoolSize: 20,
        minimumPoolSize: 5,
        healthCheckIntervalMs: 30000,
        enableQueryLogging: false,
        logLevel: 'info',
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 300000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
        connectionTimeoutMillis: 30000,
        statementTimeoutMillis: 60000,
        queryTimeoutMillis: 30000,
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'test',
        ssl: false,
        sslRejectUnauthorized: true,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseMigrationService,
        {
          provide: DATABASE_POOL_TOKEN,
          useValue: mockPool,
        },
        {
          provide: DatabaseConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DatabaseMigrationService>(DatabaseMigrationService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMigration', () => {
    it('should create a new migration file', async () => {
      mockFs.writeFile.mockResolvedValue(void 0);

      const filePath = await service.createMigration('create_users_table');

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(filePath).toMatch(/create_users_table\.sql$/);
    });

    it('should sanitize migration name', async () => {
      mockFs.writeFile.mockResolvedValue(void 0);

      const filePath = await service.createMigration('Create Users Table!@#');

      expect(filePath).toMatch(/create_users_table\.sql$/);
    });

    it('should throw error for empty migration name', async () => {
      await expect(service.createMigration('')).rejects.toThrow(
        'Migration name is required',
      );
    });
  });

  describe('validateMigrations', () => {
    it('should validate migration files successfully', async () => {
      // Mock migration files
      mockFs.readdir.mockResolvedValue(['20240101000000_test.sql'] as any);
      mockFs.readFile.mockResolvedValue(
        '-- +migrate Up\nCREATE TABLE test();\n-- +migrate Down\nDROP TABLE test;',
      );

      // Mock executed migrations
      const mockMany = jest.fn().mockResolvedValue([]);
      (mockPool.many as jest.Mock) = mockMany;

      const validation = await service.validateMigrations();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect checksum mismatch', async () => {
      // Mock migration files
      mockFs.readdir.mockResolvedValue(['20240101000000_test.sql'] as any);
      mockFs.readFile.mockResolvedValue(
        '-- +migrate Up\nCREATE TABLE test();\n-- +migrate Down\nDROP TABLE test;',
      );

      // Mock executed migrations with different checksum
      const mockMany = jest.fn().mockResolvedValue([
        {
          name: '20240101000000_test',
          executed_at: new Date(),
          checksum: 'different_checksum',
        },
      ]);
      (mockPool.many as jest.Mock) = mockMany;

      const validation = await service.validateMigrations();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringContaining('Checksum mismatch'),
      );
    });

    it('should detect invalid filename format', async () => {
      // Mock migration files with invalid name
      mockFs.readdir.mockResolvedValue(['invalid_migration_name.sql'] as any);
      mockFs.readFile.mockResolvedValue('-- +migrate Up\nCREATE TABLE test();');

      // Mock executed migrations
      const mockMany = jest.fn().mockResolvedValue([]);
      (mockPool.many as jest.Mock) = mockMany;

      const validation = await service.validateMigrations();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringContaining('Invalid migration filename format'),
      );
    });
  });

  describe('status', () => {
    it('should return migration status', async () => {
      // Mock migration files
      mockFs.readdir.mockResolvedValue(['20240101000000_test.sql'] as any);
      mockFs.readFile.mockResolvedValue('-- +migrate Up\nCREATE TABLE test();');

      // Mock executed migrations
      const mockMany = jest.fn().mockResolvedValue([
        {
          name: '20240101000000_test',
          executed_at: new Date('2024-01-01'),
          checksum: 'test_checksum',
        },
      ]);
      (mockPool.many as jest.Mock) = mockMany;

      const status = await service.status();

      expect(status).toHaveLength(1);
      expect(status[0].name).toBe('20240101000000_test');
      expect(status[0].executed).toBe(true);
    });

    it('should handle no migrations', async () => {
      mockFs.readdir.mockResolvedValue([]);
      const mockMany = jest.fn().mockResolvedValue([]);
      (mockPool.many as jest.Mock) = mockMany;

      const status = await service.status();

      expect(status).toHaveLength(0);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return pending migrations', async () => {
      // Mock migration files
      mockFs.readdir.mockResolvedValue([
        '20240101000000_migration1.sql',
        '20240102000000_migration2.sql',
      ] as any);
      mockFs.readFile.mockResolvedValue('-- +migrate Up\nCREATE TABLE test();');

      // Mock only first migration as executed
      const mockMany = jest.fn().mockResolvedValue([
        {
          name: '20240101000000_migration1',
          executed_at: new Date(),
          checksum: 'test_checksum',
        },
      ]);
      (mockPool.many as jest.Mock) = mockMany;

      const pending = await service.getPendingMigrations();

      expect(pending).toHaveLength(1);
      expect(pending[0].name).toBe('20240102000000_migration2');
    });
  });

  describe('up', () => {
    it('should execute pending migrations', async () => {
      // Mock migration files
      mockFs.readdir.mockResolvedValue(['20240101000000_test.sql'] as any);
      mockFs.readFile.mockResolvedValue(
        '-- +migrate Up\nCREATE TABLE test();\n-- +migrate Down\nDROP TABLE test;',
      );

      // Mock no executed migrations
      const mockMany = jest.fn().mockResolvedValue([]);
      (mockPool.many as jest.Mock) = mockMany;

      // Mock transaction
      const mockTransaction = jest
        .fn()
        .mockImplementation((callback) => callback(mockPool));
      (mockPool.transaction as jest.Mock) = mockTransaction;

      // Mock query for creating migration table and executing migration
      const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
      (mockPool.query as jest.Mock) = mockQuery;

      const results = await service.up();

      expect(results).toHaveLength(1);
      expect(results[0].executed).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should return empty array when no pending migrations', async () => {
      mockFs.readdir.mockResolvedValue([]);
      const mockMany = jest.fn().mockResolvedValue([]);
      (mockPool.many as jest.Mock) = mockMany;

      const results = await service.up();

      expect(results).toHaveLength(0);
    });
  });
});

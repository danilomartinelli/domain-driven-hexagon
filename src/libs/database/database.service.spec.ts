import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { DatabaseConfigService } from './database-config.service';
import { DATABASE_POOL_TOKEN } from './database.constants';
import { DatabasePool } from 'slonik';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: Partial<DatabasePool>;
  let mockConfigService: Partial<DatabaseConfigService>;

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      oneFirst: jest.fn(),
      many: jest.fn(),
      transaction: jest.fn(),
      end: jest.fn(),
    };

    mockConfigService = {
      config: {
        maximumPoolSize: 20,
        minimumPoolSize: 5,
        healthCheckIntervalMs: 30000,
        enableQueryLogging: false,
        logLevel: 'info',
        migrationTableName: 'migration',
        migrationsPath: './database/migrations',
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
        DatabaseService,
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

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the database pool', () => {
    const pool = service.getPool();
    expect(pool).toBe(mockPool);
  });

  it('should test database connection', async () => {
    const mockOneFirst = jest.fn().mockResolvedValue(1);
    (mockPool.oneFirst as jest.Mock) = mockOneFirst;

    const result = await service.testConnection();

    expect(result).toBe(true);
    expect(mockOneFirst).toHaveBeenCalled();
  });

  it('should handle connection test failure', async () => {
    const mockOneFirst = jest
      .fn()
      .mockRejectedValue(new Error('Connection failed'));
    (mockPool.oneFirst as jest.Mock) = mockOneFirst;

    const result = await service.testConnection();

    expect(result).toBe(false);
  });

  it('should execute transaction', async () => {
    const mockTransaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockPool));
    (mockPool.transaction as jest.Mock) = mockTransaction;

    const result = await service.transaction(async () => {
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should get health status', async () => {
    const mockOneFirst = jest.fn().mockResolvedValue(1);
    const mockMany = jest
      .fn()
      .mockResolvedValue([
        { total_connections: 5, active_connections: 2, idle_connections: 3 },
      ]);

    (mockPool.oneFirst as jest.Mock) = mockOneFirst;
    (mockPool.many as jest.Mock) = mockMany;

    const healthStatus = await service.getHealthStatus();

    expect(healthStatus.status).toBe('healthy');
    expect(healthStatus.responseTime).toBeGreaterThan(0);
    expect(healthStatus.details).toBeDefined();
  });

  it('should handle health check failure', async () => {
    const mockOneFirst = jest
      .fn()
      .mockRejectedValue(new Error('Health check failed'));
    (mockPool.oneFirst as jest.Mock) = mockOneFirst;

    const healthStatus = await service.getHealthStatus();

    expect(healthStatus.status).toBe('unhealthy');
    expect(healthStatus.error).toBe('Health check failed');
  });

  it('should cleanup on module destroy', async () => {
    const mockEnd = jest.fn().mockResolvedValue(void 0);
    (mockPool.end as jest.Mock) = mockEnd;

    await service.onModuleDestroy();

    expect(mockEnd).toHaveBeenCalled();
  });
});

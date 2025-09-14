/**
 * Test utilities for refactored Domain-Driven Hexagon components
 * Provides mock generators, performance measurement tools, and test helpers
 */

import {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  SqlToken,
} from 'slonik';
import { LoggerPort } from '@libs/ports/logger.port';
import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRoles } from '@modules/user/domain/user.types';
import {
  DatabaseEnvironmentVariables,
  DatabaseEnvironment,
  DatabaseLogLevel,
  DatabaseSslMode,
} from '@libs/database/config/database-config.types';

/**
 * Performance measurement utilities
 */
export class PerformanceMeasurement {
  private static measurements: Map<string, number[]> = new Map();

  static startMeasurement(key: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      if (!this.measurements.has(key)) {
        this.measurements.set(key, []);
      }
      this.measurements.get(key)?.push(duration);
      return duration;
    };
  }

  static getStats(key: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
    percentile95: number;
  } {
    const measurements = this.measurements.get(key) || [];
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, percentile95: 0 };
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    const percentile95Index = Math.ceil(sorted.length * 0.95) - 1;

    return {
      avg: sum / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: measurements.length,
      percentile95: sorted[percentile95Index] || 0,
    };
  }

  static reset(): void {
    this.measurements.clear();
  }

  static getAllMeasurements(): Map<string, number[]> {
    return new Map(this.measurements);
  }
}

/**
 * Memory usage measurement utilities
 */
export class MemoryMeasurement {
  private static snapshots: Map<string, NodeJS.MemoryUsage> = new Map();

  static takeSnapshot(key: string): NodeJS.MemoryUsage {
    const usage = process.memoryUsage();
    this.snapshots.set(key, usage);
    return usage;
  }

  static getUsageDelta(
    startKey: string,
    endKey: string,
  ): {
    heapUsedDelta: number;
    heapTotalDelta: number;
    externalDelta: number;
    rssUsedDelta: number;
  } {
    const start = this.snapshots.get(startKey);
    const end = this.snapshots.get(endKey);

    if (!start || !end) {
      throw new Error(
        `Memory snapshots not found for keys: ${startKey}, ${endKey}`,
      );
    }

    return {
      heapUsedDelta: end.heapUsed - start.heapUsed,
      heapTotalDelta: end.heapTotal - start.heapTotal,
      externalDelta: end.external - start.external,
      rssUsedDelta: end.rss - start.rss,
    };
  }

  static reset(): void {
    this.snapshots.clear();
  }
}

/**
 * Mock database pool implementation for testing
 */
export class MockDatabasePool implements Partial<DatabasePool> {
  private queryResults: Map<string, any> = new Map();
  private queryCallCount: Map<string, number> = new Map();
  private queryLatency: number = 0;
  private shouldThrow: boolean = false;
  private throwError: Error | null = null;

  constructor(private readonly testName: string = 'default') {}

  async query(sql: SqlToken): Promise<QueryResult<any>> {
    const sqlString = sql.toString();

    // Track query calls
    const currentCount = this.queryCallCount.get(sqlString) || 0;
    this.queryCallCount.set(sqlString, currentCount + 1);

    // Simulate latency
    if (this.queryLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.queryLatency));
    }

    // Handle error simulation
    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }

    // Return predefined result
    const result = this.queryResults.get(sqlString) || {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
    };

    return result as QueryResult<any>;
  }

  // Test utilities
  setQueryResult(sql: string, result: unknown): void {
    this.queryResults.set(sql, result);
  }

  setLatency(ms: number): void {
    this.queryLatency = ms;
  }

  simulateError(error: Error): void {
    this.shouldThrow = true;
    this.throwError = error;
  }

  resetError(): void {
    this.shouldThrow = false;
    this.throwError = null;
  }

  getQueryCallCount(sql: string): number {
    return this.queryCallCount.get(sql) || 0;
  }

  getAllQueryCalls(): Map<string, number> {
    return new Map(this.queryCallCount);
  }

  reset(): void {
    this.queryResults.clear();
    this.queryCallCount.clear();
    this.queryLatency = 0;
    this.resetError();
  }
}

/**
 * Mock database transaction connection
 */
export class MockTransactionConnection
  implements Partial<DatabaseTransactionConnection>
{
  private mockPool: MockDatabasePool;

  constructor(testName: string = 'transaction') {
    this.mockPool = new MockDatabasePool(testName);
  }

  async query(sql: SqlToken): Promise<QueryResult<any>> {
    return this.mockPool.query(sql);
  }

  // Delegate test utilities to underlying pool
  setQueryResult(sql: string, result: unknown): void {
    this.mockPool.setQueryResult(sql, result);
  }

  setLatency(ms: number): void {
    this.mockPool.setLatency(ms);
  }

  simulateError(error: Error): void {
    this.mockPool.simulateError(error);
  }

  resetError(): void {
    this.mockPool.resetError();
  }

  getQueryCallCount(sql: string): number {
    return this.mockPool.getQueryCallCount(sql);
  }

  reset(): void {
    this.mockPool.reset();
  }
}

/**
 * Mock logger implementation for testing
 */
export class MockLogger implements LoggerPort {
  private logs: Array<{ level: string; message: string; context?: unknown }> =
    [];

  debug(message: string, context?: unknown): void {
    this.logs.push({ level: 'debug', message, context });
  }

  info(message: string, context?: unknown): void {
    this.logs.push({ level: 'info', message, context });
  }

  warn(message: string, context?: unknown): void {
    this.logs.push({ level: 'warn', message, context });
  }

  error(message: string, context?: unknown): void {
    this.logs.push({ level: 'error', message, context });
  }

  fatal(message: string, context?: unknown): void {
    this.logs.push({ level: 'fatal', message, context });
  }

  getLogs(): Array<{ level: string; message: string; context?: unknown }> {
    return [...this.logs];
  }

  getLogsByLevel(
    level: string,
  ): Array<{ level: string; message: string; context?: unknown }> {
    return this.logs.filter((log) => log.level === level);
  }

  hasLogWithMessage(message: string): boolean {
    return this.logs.some((log) => log.message.includes(message));
  }

  hasLogWithLevel(level: string): boolean {
    return this.logs.some((log) => log.level === level);
  }

  clear(): void {
    this.logs = [];
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

/**
 * Test data builders for User entities
 */
export class UserTestDataBuilder {
  private props: any = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    role: UserRoles.guest,
    isActive: true,
    isEmailVerified: true,
    isLocked: false,
    loginAttempts: 0,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  static create(): UserTestDataBuilder {
    return new UserTestDataBuilder();
  }

  withEmail(email: string): this {
    this.props.email = email;
    return this;
  }

  withPassword(password: string): this {
    this.props.password = password;
    return this;
  }

  withRole(role: UserRoles): this {
    this.props.role = role;
    return this;
  }

  withActiveStatus(isActive: boolean): this {
    this.props.isActive = isActive;
    return this;
  }

  withEmailVerified(isVerified: boolean): this {
    this.props.isEmailVerified = isVerified;
    return this;
  }

  withLockedStatus(isLocked: boolean): this {
    this.props.isLocked = isLocked;
    return this;
  }

  withLoginAttempts(attempts: number): this {
    this.props.loginAttempts = attempts;
    return this;
  }

  withLastLogin(date: Date | null): this {
    this.props.lastLoginAt = date;
    return this;
  }

  withEmailVerificationToken(token: string): this {
    this.props.emailVerificationToken = token;
    return this;
  }

  withPasswordResetToken(token: string, expiresAt: Date): this {
    this.props.passwordResetToken = token;
    this.props.passwordResetTokenExpiresAt = expiresAt;
    return this;
  }

  build(): UserEntity {
    return UserEntity.create(this.props);
  }

  buildInactive(): UserEntity {
    return this.withActiveStatus(false).build();
  }

  buildLocked(): UserEntity {
    return this.withLockedStatus(true).build();
  }

  buildUnverified(): UserEntity {
    return this.withEmailVerified(false).build();
  }

  buildModerator(): UserEntity {
    return this.withRole(UserRoles.moderator).build();
  }

  buildAdmin(): UserEntity {
    return this.withRole(UserRoles.admin).build();
  }

  buildWithManyFailedAttempts(): UserEntity {
    return this.withLoginAttempts(6).build();
  }

  buildStaleUser(): UserEntity {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return this.withLastLogin(sixMonthsAgo).build();
  }
}

/**
 * Environment variable test utilities
 */
export class EnvironmentTestUtils {
  private originalEnv: Record<string, string | undefined> = {};

  static create(): EnvironmentTestUtils {
    return new EnvironmentTestUtils();
  }

  setEnvironmentVariables(
    variables: Partial<DatabaseEnvironmentVariables>,
  ): this {
    // Store original values
    for (const [key, value] of Object.entries(variables)) {
      if (!(key in this.originalEnv)) {
        this.originalEnv[key] = process.env[key];
      }
      process.env[key] = String(value);
    }
    return this;
  }

  createTestEnvironmentVariables(): DatabaseEnvironmentVariables {
    return {
      NODE_ENV: DatabaseEnvironment.TEST,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'testuser',
      DB_PASSWORD: 'testpass',
      DB_NAME: 'testdb',
      DB_SSL: false,
      DB_SSL_MODE: 'prefer',
      DB_SSL_REJECT_UNAUTHORIZED: true,
      DB_MAX_POOL_SIZE: 10,
      DB_MIN_POOL_SIZE: 1,
      DB_CONNECTION_TIMEOUT: 30000,
      DB_STATEMENT_TIMEOUT: 60000,
      DB_QUERY_TIMEOUT: 10000,
      DB_LOG_LEVEL: DatabaseLogLevel.DEBUG,
      DB_ENABLE_QUERY_LOGGING: true,
    };
  }

  createProductionEnvironmentVariables(): Partial<DatabaseEnvironmentVariables> {
    return {
      NODE_ENV: DatabaseEnvironment.PRODUCTION,
      DB_HOST: 'prod-db.example.com',
      DB_PORT: 5432,
      DB_SSL: true,
      DB_SSL_MODE: DatabaseSslMode.REQUIRE,
      DB_SSL_REJECT_UNAUTHORIZED: true,
      DB_MAX_POOL_SIZE: 20,
      DB_MIN_POOL_SIZE: 5,
      DB_ENABLE_QUERY_LOGGING: false,
    };
  }

  createInvalidEnvironmentVariables(): Partial<Record<string, any>> {
    return {
      DB_PORT: 'invalid-port',
      DB_MAX_POOL_SIZE: -1,
      DB_CONNECTION_TIMEOUT: 'not-a-number',
      DB_SSL: 'maybe',
    };
  }

  restore(): void {
    // Restore original environment variables
    for (const [key, originalValue] of Object.entries(this.originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
    this.originalEnv = {};
  }
}

/**
 * Test assertion helpers
 */
export class TestAssertions {
  /**
   * Assert that performance improvement meets target percentage
   */
  static assertPerformanceImprovement(
    beforeStats: { avg: number },
    afterStats: { avg: number },
    targetImprovementPercent: number,
    description: string,
  ): void {
    const actualImprovement =
      ((beforeStats.avg - afterStats.avg) / beforeStats.avg) * 100;

    if (actualImprovement < targetImprovementPercent) {
      throw new Error(
        `${description}: Expected ${targetImprovementPercent}% improvement, but got ${actualImprovement.toFixed(2)}%`,
      );
    }
  }

  /**
   * Assert memory usage reduction meets target percentage
   */
  static assertMemoryReduction(
    beforeUsage: number,
    afterUsage: number,
    targetReductionPercent: number,
    description: string,
  ): void {
    const actualReduction = ((beforeUsage - afterUsage) / beforeUsage) * 100;

    if (actualReduction < targetReductionPercent) {
      throw new Error(
        `${description}: Expected ${targetReductionPercent}% memory reduction, but got ${actualReduction.toFixed(2)}%`,
      );
    }
  }

  /**
   * Assert that a value is within expected percentage range
   */
  static assertWithinPercentage(
    actual: number,
    expected: number,
    tolerancePercent: number,
    description: string,
  ): void {
    const tolerance = (expected * tolerancePercent) / 100;
    const lowerBound = expected - tolerance;
    const upperBound = expected + tolerance;

    if (actual < lowerBound || actual > upperBound) {
      throw new Error(
        `${description}: Expected ${actual} to be within ${tolerancePercent}% of ${expected} (${lowerBound}-${upperBound})`,
      );
    }
  }
}

/**
 * Benchmark utility for consistent performance testing
 */
export class BenchmarkRunner {
  static async run<T>(
    name: string,
    operation: () => Promise<T> | T,
    iterations: number = 100,
  ): Promise<{
    result: T;
    stats: ReturnType<typeof PerformanceMeasurement.getStats>;
  }> {
    PerformanceMeasurement.reset();

    let lastResult: T;

    for (let i = 0; i < iterations; i++) {
      const endMeasurement = PerformanceMeasurement.startMeasurement(name);
      lastResult = await operation();
      endMeasurement();
    }

    const stats = PerformanceMeasurement.getStats(name);
    return { result: lastResult, stats };
  }

  static async compare<T>(
    operations: Array<{ name: string; operation: () => Promise<T> | T }>,
    iterations: number = 100,
  ): Promise<
    Array<{
      name: string;
      result: T;
      stats: ReturnType<typeof PerformanceMeasurement.getStats>;
    }>
  > {
    const results = [];

    for (const op of operations) {
      const result = await this.run(op.name, op.operation, iterations);
      results.push({ name: op.name, ...result });
    }

    return results;
  }
}

/**
 * Cache testing utilities
 */
export class CacheTestUtils {
  /**
   * Test cache behavior with controlled operations
   */
  static async testCacheEffectiveness<T>(
    cacheableOperation: (key: string) => T,
    testKeys: string[],
  ): Promise<{ hitRate: number; operations: number }> {
    let cacheHits = 0;
    let totalOperations = 0;

    // First pass - populate cache
    for (const key of testKeys) {
      cacheableOperation(key);
      totalOperations++;
    }

    // Second pass - should hit cache
    for (const key of testKeys) {
      const beforeTime = performance.now();
      cacheableOperation(key);
      const afterTime = performance.now();

      // Assume cache hit if operation is very fast (< 1ms)
      if (afterTime - beforeTime < 1) {
        cacheHits++;
      }
      totalOperations++;
    }

    const hitRate = (cacheHits / testKeys.length) * 100;

    return { hitRate, operations: totalOperations };
  }

  /**
   * Generate test data for cache testing
   */
  static generateTestPasswords(count: number): string[] {
    const passwords = [];
    const bases = ['password123', 'SecurePass1!', 'MyP@ssword', 'Test1234!'];

    for (let i = 0; i < count; i++) {
      const base = bases[i % bases.length];
      passwords.push(`${base}${i}`);
    }

    return passwords;
  }
}

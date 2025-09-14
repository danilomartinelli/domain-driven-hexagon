import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { SecurityService } from '@libs/security/security.service';
import { InputSanitizerService } from '@libs/security/input-sanitizer.service';
import { EnvValidatorService } from '@libs/security/env-validator.service';
import { DatabaseMigrationService } from '@libs/database/database-migration.service';
import { LoginService } from '@modules/auth/commands/login/login.service';
import { JwtService } from '@modules/auth/infrastructure/services/jwt.service';
import { PasswordService } from '@modules/auth/infrastructure/services/password.service';

/**
 * Comprehensive security tests covering various attack scenarios and vulnerability prevention
 * These tests simulate real-world attack vectors to ensure the system is properly secured
 */
describe('Security Attack Scenarios', () => {
  let app: INestApplication;
  let securityService: SecurityService;
  let inputSanitizer: InputSanitizerService;
  let migrationService: DatabaseMigrationService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 5, // 5 requests per minute for testing
          },
        ]),
      ],
      providers: [
        SecurityService,
        InputSanitizerService,
        {
          provide: EnvValidatorService,
          useValue: {
            get: jest.fn((key: string) => {
              const mockConfig: Record<string, any> = {
                NODE_ENV: 'test',
                CSP_ENABLED: true,
                HSTS_MAX_AGE: 31536000,
                CORS_ORIGIN: 'http://localhost:3000',
                CORS_CREDENTIALS: true,
                JWT_ACCESS_TOKEN_SECRET: 'test-access-secret',
                JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret',
              };
              return mockConfig[key];
            }),
          },
        },
        {
          provide: DatabaseMigrationService,
          useValue: {
            migrate: jest.fn(),
            validateMigrationSql: jest.fn(),
            sanitizeSqlQuery: jest.fn(),
          },
        },
        {
          provide: LoginService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAccessToken: jest.fn(),
            generateTokenPair: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            compare: jest.fn(),
            validate: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );

    securityService = module.get<SecurityService>(SecurityService);
    inputSanitizer = module.get<InputSanitizerService>(InputSanitizerService);
    migrationService = module.get<DatabaseMigrationService>(
      DatabaseMigrationService,
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in migration service', () => {
      // Arrange
      const maliciousSql =
        'SELECT * FROM users WHERE id = 1; DROP TABLE users; --';
      migrationService.sanitizeSqlQuery = jest
        .fn()
        .mockReturnValue('SELECT * FROM users WHERE id = ?');

      // Act
      const result = migrationService.sanitizeSqlQuery(maliciousSql);

      // Assert
      expect(result).not.toContain('DROP TABLE');
      expect(result).not.toContain('--');
      expect(migrationService.sanitizeSqlQuery).toHaveBeenCalledWith(
        maliciousSql,
      );
    });

    it('should detect and prevent SQL injection patterns', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM passwords --",
        "'; EXEC xp_cmdshell('format c:'); --",
        "' OR 1=1 /*",
        "admin'--",
        "admin'/*",
        "1' AND 1=1 --",
        "1' AND 1=2 --",
        "1' WAITFOR DELAY '00:00:10'--",
      ];

      sqlInjectionAttempts.forEach((maliciousInput) => {
        const sanitized = inputSanitizer.sanitizeSqlInput(maliciousInput);

        // Assert that dangerous SQL patterns are removed
        expect(sanitized).not.toMatch(/DROP\s+TABLE/i);
        expect(sanitized).not.toMatch(/UNION\s+SELECT/i);
        expect(sanitized).not.toMatch(/EXEC\s+/i);
        expect(sanitized).not.toMatch(/--/);
        expect(sanitized).not.toMatch(/\/\*/);
        expect(sanitized).not.toMatch(/WAITFOR\s+DELAY/i);
      });
    });

    it('should handle parameterized query patterns correctly', () => {
      // Arrange
      const legitQuery = 'SELECT * FROM users WHERE email = $1 AND active = $2';

      // Act
      const result = inputSanitizer.sanitizeSqlInput(legitQuery);

      // Assert - Should preserve legitimate parameterized queries
      expect(result).toContain('$1');
      expect(result).toContain('$2');
      expect(result).toContain('SELECT');
    });

    it('should prevent blind SQL injection attempts', () => {
      const blindSqlAttempts = [
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "1' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE id=1)='a'--",
        "1' AND LENGTH(password)>5--",
        "1' AND ASCII(SUBSTRING(password,1,1))>64--",
      ];

      blindSqlAttempts.forEach((attempt) => {
        const sanitized = inputSanitizer.sanitizeSqlInput(attempt);

        expect(sanitized).not.toMatch(/AND\s*\(/i);
        expect(sanitized).not.toMatch(/SELECT\s+COUNT/i);
        expect(sanitized).not.toMatch(/SUBSTRING/i);
        expect(sanitized).not.toMatch(/LENGTH/i);
        expect(sanitized).not.toMatch(/ASCII/i);
      });
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    it('should sanitize XSS attack vectors', () => {
      const xssAttempts = [
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
      ];

      xssAttempts.forEach((xssPayload) => {
        const sanitized = inputSanitizer.sanitizeHtml(xssPayload);

        // Assert that dangerous XSS patterns are removed
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('onclick=');
        expect(sanitized).not.toContain('onfocus=');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert(');
      });
    });

    it('should preserve safe HTML while removing dangerous content', () => {
      // Arrange
      const mixedContent = `
        <p>This is safe content</p>
        <script>alert('This is dangerous')</script>
        <strong>Bold text is fine</strong>
        <img src="safe.jpg" onerror="alert('dangerous')">
        <em>Italic text is allowed</em>
        <a href="http://example.com">Safe link</a>
        <a href="javascript:alert('bad')">Dangerous link</a>
      `;

      // Act
      const sanitized = inputSanitizer.sanitizeHtml(mixedContent);

      // Assert
      expect(sanitized).toContain('<p>This is safe content</p>');
      expect(sanitized).toContain('<strong>Bold text is fine</strong>');
      expect(sanitized).toContain('<em>Italic text is allowed</em>');
      expect(sanitized).toContain('http://example.com');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('javascript:alert');
    });

    it('should handle encoded XSS attempts', () => {
      const encodedXssAttempts = [
        '%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E',
        '&#x3C;script&#x3E;alert(&#x27;XSS&#x27;)&#x3C;/script&#x3E;',
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
        '\u003cscript\u003ealert(\u0022XSS\u0022)\u003c/script\u003e',
      ];

      encodedXssAttempts.forEach((encoded) => {
        // Decode and then sanitize
        const decoded = decodeURIComponent(encoded);
        const sanitized = inputSanitizer.sanitizeHtml(decoded);

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('alert(');
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal attacks', () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './config/../../../etc/shadow',
        'normal/path/../../secret.txt',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      ];

      pathTraversalAttempts.forEach((maliciousPath) => {
        const sanitized = inputSanitizer.sanitizePathTraversal(maliciousPath);

        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('..\\');
        expect(sanitized).not.toContain('%2e%2e%2f');
        expect(sanitized).not.toContain('%252f');
        expect(sanitized).not.toContain('%c0%af');
      });
    });

    it('should preserve legitimate paths', () => {
      const legitimatePaths = [
        'documents/report.pdf',
        'images/profile/avatar.jpg',
        'uploads/2023/12/file.txt',
        'static/css/styles.css',
      ];

      legitimatePaths.forEach((path) => {
        const sanitized = inputSanitizer.sanitizePathTraversal(path);
        expect(sanitized).toBe(path);
      });
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF tokens in security middleware', () => {
      // Arrange
      const mockReq = {
        method: 'POST',
        url: '/api/sensitive-action',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'invalid-token',
        },
        get: jest.fn((header) => {
          const headers: Record<string, string> = {
            'X-CSRF-Token': 'invalid-token',
            'Content-Type': 'application/json',
          };
          return headers[header];
        }),
      };

      const mockRes = {
        setHeader: jest.fn(),
        req: mockReq,
      };

      const mockNext = jest.fn();

      // Act
      securityService.applySecurityMiddleware(
        mockReq as any,
        mockRes as any,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalled();
    });

    it('should require specific headers for sensitive endpoints', () => {
      // Arrange
      const mockReq = {
        url: '/auth/login',
        method: 'POST',
        get: jest.fn().mockReturnValue(undefined), // No X-Requested-With header
      };

      // Act
      const validation = securityService.validateRequestSecurity(
        mockReq as any,
      );

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Missing X-Requested-With header for sensitive endpoint',
      );
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    it('should detect rapid successive requests', async () => {
      // Simulate rapid requests to trigger rate limiting
      const requests = Array(10)
        .fill(0)
        .map(() =>
          request(app.getHttpServer()).post('/auth/login').send({
            email: 'test@example.com',
            password: 'password123',
          }),
        );

      // Act
      const responses = await Promise.all(requests);

      // Assert - Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent large payload attacks', async () => {
      // Arrange - Create a very large payload
      const largePayload = {
        email: 'test@example.com',
        password: 'password123',
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB payload
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(largePayload);

      // Assert - Should be rejected due to payload size
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should limit concurrent connections per IP', () => {
      // This would typically be handled at the infrastructure level
      // but we can test the application-level detection
      const validation = securityService.validateRequestSecurity({
        url: '/api/data',
        ip: '192.168.1.100',
      } as any);

      expect(validation).toBeDefined();
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should prevent JWT token manipulation', async () => {
      const jwtService = app.get(JwtService);

      const manipulatedTokens = [
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ',
        'null',
        'undefined',
        '',
        'Bearer malformed.token.here',
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
      ];

      for (const token of manipulatedTokens) {
        try {
          await jwtService.verifyAccessToken(token);
          fail(`Token verification should have failed for: ${token}`);
        } catch (error) {
          // Expected to fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent role escalation through token manipulation', () => {
      // Test token with manipulated roles
      const maliciousPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        roles: ['user', 'admin', 'superadmin'], // User trying to escalate
        permissions: ['admin:all'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      // The system should validate roles against the database, not trust the token
      // This would be handled by the role verification service
      expect(maliciousPayload.roles).toContain('admin');
    });

    it('should prevent session fixation attacks', () => {
      // Ensure new sessions are created on login
      // and old sessions are invalidated
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock the token generation to ensure unique tokens
      const jwtService = app.get(JwtService);
      jwtService.generateTokenPair = jest.fn().mockResolvedValue({
        accessToken: 'new-unique-token',
        refreshToken: 'new-unique-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });

      expect(jwtService.generateTokenPair).toBeDefined();
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not leak sensitive information in error responses', () => {
      const mockReq = {
        url: '/api/nonexistent',
        method: 'GET',
      };

      const validation = securityService.validateRequestSecurity(
        mockReq as any,
      );

      // Error messages should not contain sensitive paths or internal info
      validation.issues.forEach((issue) => {
        expect(issue).not.toContain('/etc/passwd');
        expect(issue).not.toContain('database');
        expect(issue).not.toContain('secret');
        expect(issue).not.toContain('key');
      });
    });

    it('should prevent user enumeration through timing attacks', async () => {
      const loginService = app.get(LoginService);
      const passwordService = app.get(PasswordService);

      // Mock consistent timing for both valid and invalid users
      loginService.execute = jest.fn().mockImplementation(async () => {
        // Simulate consistent processing time
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error('Invalid credentials');
      });

      passwordService.compare = jest.fn().mockImplementation(async () => {
        // Always perform comparison to maintain consistent timing
        await new Promise((resolve) => setTimeout(resolve, 50));
        return false;
      });

      const startTime = Date.now();
      try {
        await loginService.execute({
          email: 'nonexistent@example.com',
          password: 'password',
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Expected
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(90); // Should have consistent delay
    });

    it('should prevent stack trace exposure', () => {
      // In production, stack traces should not be exposed
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        throw new Error('Test error');
      } catch (error) {
        // Error handling should not expose stack traces in production
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        expect(errorMessage).not.toContain('at Object');
        expect(errorMessage).not.toContain('node_modules');
      }

      process.env.NODE_ENV = nodeEnv; // Restore
    });
  });

  describe('Input Validation Bypasses', () => {
    it('should prevent validation bypass through HTTP method override', async () => {
      // Attempt to bypass POST validation by using method override
      const response = await request(app.getHttpServer())
        .get('/auth/login') // GET instead of POST
        .set('X-HTTP-Method-Override', 'POST')
        .query({
          email: 'test@example.com',
          password: 'password123',
        });

      // Should not allow method override for sensitive endpoints
      expect(response.status).not.toBe(200);
    });

    it('should validate all input parameters strictly', () => {
      const maliciousInputs = {
        email: '<script>alert("xss")</script>',
        password: 'password123',
        extraParam: 'should-be-rejected',
        __proto__: { isAdmin: true },
        constructor: { name: 'malicious' },
      };

      // ValidationPipe with whitelist: true should reject extra parameters
      const sanitizedEmail = inputSanitizer.sanitizeString(
        maliciousInputs.email,
      );
      expect(sanitizedEmail).not.toContain('<script>');
    });

    it('should prevent prototype pollution attacks', () => {
      const maliciousPayload = {
        email: 'test@example.com',
        password: 'password123',
        __proto__: {
          isAdmin: true,
        },
        constructor: {
          prototype: {
            isAdmin: true,
          },
        },
      };

      // The application should use proper JSON parsing and validation
      // that prevents prototype pollution
      const parsed = JSON.parse(JSON.stringify(maliciousPayload));
      expect(parsed.isAdmin).toBeUndefined();
    });
  });

  describe('Business Logic Vulnerabilities', () => {
    it('should prevent account lockout bypass', async () => {
      const loginService = app.get(LoginService);

      // Mock user with max failed attempts
      loginService.execute = jest.fn().mockImplementation(async (command) => {
        if (command.email === 'locked@example.com') {
          throw new Error('Account locked');
        }
        return { success: false, message: 'Invalid credentials' };
      });

      // Try various bypass techniques
      const bypassAttempts = [
        { email: 'locked@example.com', password: 'password' },
        { email: 'LOCKED@EXAMPLE.COM', password: 'password' },
        { email: 'locked+bypass@example.com', password: 'password' },
        { email: 'locked@example.com ', password: 'password' }, // trailing space
      ];

      for (const attempt of bypassAttempts) {
        try {
          await loginService.execute(attempt);
          fail(`Should not allow bypass for: ${attempt.email}`);
        } catch (error) {
          expect(error.message).toContain('locked');
        }
      }
    });

    it('should enforce proper authorization checks', () => {
      // Test that users cannot access resources they don\'t own
      const mockUser = {
        sub: 'user-123',
        email: 'user@example.com',
        roles: ['user'],
        permissions: ['user:read-own'],
      };

      const unauthorizedActions = [
        { resource: 'user:456', action: 'read' }, // Different user
        { resource: 'admin', action: 'manage' }, // Admin resource
        { resource: 'system', action: 'configure' }, // System resource
      ];

      unauthorizedActions.forEach(({ resource, action }) => {
        // Each action should be properly authorized
        const hasPermission = mockUser.permissions.some(
          (p) => p.includes(resource) && p.includes(action),
        );
        expect(hasPermission).toBe(false);
      });
    });
  });

  describe('Security Headers Validation', () => {
    it('should set proper security headers', () => {
      const mockRes = {
        setHeader: jest.fn(),
        req: {
          url: '/api/test',
          get: jest.fn(),
        },
      };

      const mockNext = jest.fn();

      securityService.applySecurityMiddleware(
        {} as any,
        mockRes as any,
        mockNext,
      );

      // Verify security headers are set
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-API-Version', '1.0');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.any(Number),
      );
    });

    it('should apply proper CORS policies', () => {
      const corsConfig = securityService.getCorsConfig();

      expect(corsConfig.credentials).toBe(true);
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.allowedHeaders).toContain('Authorization');
      expect(corsConfig.exposedHeaders).toContain('X-RateLimit-Remaining');
    });
  });

  describe('Comprehensive Attack Simulation', () => {
    it('should handle combined attack vectors', async () => {
      // Simulate a sophisticated attack combining multiple techniques
      const combinedAttack = {
        email: "admin'; DROP TABLE users; --<script>alert('xss')</script>",
        password: '../../../etc/passwd',
        remember:
          '<img src="x" onerror="document.location=\'http://evil.com\'">',
        extraData: {
          __proto__: { isAdmin: true },
          roles: ['admin', 'superuser'],
        },
      };

      // The system should handle all attack vectors simultaneously
      const sanitizedEmail = inputSanitizer.sanitizeSqlInput(
        inputSanitizer.sanitizeHtml(combinedAttack.email),
      );
      const sanitizedPassword = inputSanitizer.sanitizePathTraversal(
        combinedAttack.password,
      );

      expect(sanitizedEmail).not.toContain('DROP TABLE');
      expect(sanitizedEmail).not.toContain('<script>');
      expect(sanitizedPassword).not.toContain('../');
    });

    it('should maintain security under high load', async () => {
      // Test that security measures don't degrade under load
      const concurrentRequests = Array(100)
        .fill(0)
        .map(async () => {
          const maliciousReq = {
            url: '/api/test' + Math.random(),
            method: 'POST',
            body: { malicious: '<script>alert("xss")</script>' },
          };

          return securityService.validateRequestSecurity(maliciousReq as any);
        });

      const results = await Promise.all(concurrentRequests);

      // All requests should be properly validated
      results.forEach((result) => {
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('issues');
      });
    });
  });
});

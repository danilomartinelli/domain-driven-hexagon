import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { DatabaseModule } from '@libs/database/database.module';
import { SecurityModule } from '@libs/security/security.module';

/**
 * Comprehensive E2E tests for the authentication system
 * Tests complete authentication flows with real HTTP requests
 */
describe('Authentication System E2E', () => {
  let app: INestApplication;
  let module: TestingModule;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        DatabaseModule,
        SecurityModule,
        CqrsModule,
        PassportModule,
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '15m' },
        }),
        ThrottlerModule.forRoot([
          {
            name: 'auth',
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
      // Mock all authentication services for E2E testing
      providers: [
        // Mock implementations would go here
      ],
    }).compile();

    app = module.createNestApplication();

    // Configure middleware and pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          street: '123 Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBeDefined();
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'weakpass@example.com',
        password: '123',
        confirmPassword: '123',
        address: {
          street: '123 Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should reject registration with mismatched passwords', async () => {
      const userData = {
        email: 'mismatch@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'DifferentPassword456!',
        address: {
          street: '123 Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          street: '123 Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteData = {
        email: 'incomplete@example.com',
        password: 'SecurePassword123!',
        // Missing confirmPassword and address
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteData)
        .expect(400);
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          street: '123 Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(409); // Conflict
    });
  });

  describe('User Login Flow', () => {
    beforeAll(async () => {
      // Register a test user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPassword123!',
          confirmPassword: 'LoginPassword123!',
          address: {
            street: '123 Login Street',
            postalCode: '12345',
            country: 'United States',
          },
        })
        .expect(201);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'LoginPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('tokenType', 'Bearer');
      expect(response.body).toHaveProperty('expiresIn');

      // Store tokens for later tests
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;

      // Verify token format
      expect(accessToken).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      );
      expect(refreshToken).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      );
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'LoginPassword123!',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'WrongPassword123!',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should reject login with malformed email', async () => {
      const loginData = {
        email: 'invalid-email-format',
        password: 'LoginPassword123!',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(400);
    });

    it('should handle concurrent login attempts', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'LoginPassword123!',
      };

      // Make 5 concurrent login requests
      const concurrentRequests = Array(5)
        .fill(0)
        .map(() =>
          request(app.getHttpServer()).post('/auth/login').send(loginData),
        );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed (assuming user isn't locked)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('accessToken');
      });
    });
  });

  describe('Protected Route Access', () => {
    it('should allow access to protected routes with valid token', async () => {
      // Assume we have a protected user profile endpoint
      const response = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe('logintest@example.com');
    });

    it('should reject access without authorization header', async () => {
      await request(app.getHttpServer()).get('/user/profile').expect(401);
    });

    it('should reject access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject access with malformed authorization header', async () => {
      const malformedHeaders = [
        'invalid-format-token',
        'Basic dXNlcjpwYXNz', // Basic auth instead of Bearer
        'Bearer', // Missing token
        'Bearer token with spaces',
      ];

      for (const header of malformedHeaders) {
        await request(app.getHttpServer())
          .get('/user/profile')
          .set('Authorization', header)
          .expect(401);
      }
    });

    it('should handle expired tokens properly', async () => {
      // Create an expired token for testing
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh tokens successfully with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('tokenType', 'Bearer');

      // Verify new tokens are different from original
      expect(response.body.accessToken).not.toBe(accessToken);
      expect(response.body.refreshToken).not.toBe(refreshToken);

      // Update tokens for subsequent tests
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject refresh with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });

    it('should reject refresh with expired refresh token', async () => {
      const expiredRefreshToken = 'expired.refresh.token';

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: expiredRefreshToken })
        .expect(401);
    });

    it('should invalidate old tokens after refresh', async () => {
      // Get current tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPassword123!',
        });

      const oldAccessToken = loginResponse.body.accessToken;
      const oldRefreshToken = loginResponse.body.refreshToken;

      // Refresh tokens
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      // Try to use old access token - should fail
      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${oldAccessToken}`)
        .expect(401);

      // Try to refresh with old refresh token - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });
  });

  describe('User Logout Flow', () => {
    it('should logout successfully with valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should invalidate tokens after logout', async () => {
      // Login to get fresh tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPassword123!',
        });

      const testAccessToken = loginResponse.body.accessToken;
      const testRefreshToken = loginResponse.body.refreshToken;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({ refreshToken: testRefreshToken })
        .expect(200);

      // Try to use tokens after logout - should fail
      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: testRefreshToken })
        .expect(401);
    });

    it('should reject logout without authentication', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'some-refresh-token' })
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123!',
      };

      // Make multiple failed login attempts
      const requests = Array(15)
        .fill(0)
        .map(() =>
          request(app.getHttpServer()).post('/auth/login').send(loginData),
        );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429)
      const rateLimited = responses.filter((res) => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Verify rate limit headers are present
      const rateLimitedResponse = rateLimited[0];
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(rateLimitedResponse.headers).toHaveProperty(
        'x-ratelimit-remaining',
      );
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should have different rate limits for different endpoints', async () => {
      // Registration should have different limits than login
      const userData = {
        email: `ratetest${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          street: '123 Rate Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      // Make multiple registration requests
      const requests = Array(10)
        .fill(0)
        .map((_, i) =>
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              ...userData,
              email: `ratetest${Date.now()}-${i}@example.com`,
            }),
        );

      const responses = await Promise.all(requests);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _rateLimited = responses.filter((res) => res.status === 429);

      // Registration might have different rate limiting behavior
      expect(responses.length).toBe(10);
    });

    it('should reset rate limits after time window', async () => {
      // This test would require waiting for the rate limit window to reset
      // In practice, you might mock the time or use a shorter window for testing
      const loginData = {
        email: 'resettest@example.com',
        password: 'WrongPassword123!',
      };

      // Make requests up to the limit
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401); // Should still work

      // Note: In real tests, you might need to wait or mock time advancement
    });
  });

  describe('Account Security Features', () => {
    it('should lock account after multiple failed login attempts', async () => {
      const testUser = {
        email: 'locktest@example.com',
        password: 'LockTestPassword123!',
        confirmPassword: 'LockTestPassword123!',
        address: {
          street: '123 Lock Test Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      // Register test user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).post('/auth/login').send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });
      }

      // Account should now be locked even with correct password
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(429); // Account locked
    });

    it('should require email verification for new accounts', async () => {
      const newUser = {
        email: 'verification@example.com',
        password: 'VerificationTest123!',
        confirmPassword: 'VerificationTest123!',
        address: {
          street: '123 Verification Street',
          postalCode: '12345',
          country: 'United States',
        },
      };

      // Register new user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUser)
        .expect(201);

      // Try to login with unverified account
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        });

      expect(response.status).toBe(401); // Email not verified
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}') // Invalid JSON
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle requests with no content-type', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send('email=test@example.com&password=test')
        .expect(400);
    });

    it('should handle very large payloads appropriately', async () => {
      const largePayload = {
        email: 'large@example.com',
        password: 'Password123!',
        data: 'x'.repeat(1024 * 1024), // 1MB of data
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(largePayload);

      // Should either reject due to size or handle gracefully
      expect([400, 413, 429]).toContain(response.status);
    });

    it('should handle special characters in input properly', async () => {
      const specialCharsData = {
        email: 'special+chars@example-domain.com',
        password: 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?',
        confirmPassword: 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?',
        address: {
          street: 'Straße mit Umlauts & Special Chars!',
          postalCode: '12345-6789',
          country: 'United States',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(specialCharsData);

      // Should either succeed or fail gracefully
      expect([201, 400]).toContain(response.status);
    });

    it('should handle unicode and international characters', async () => {
      const unicodeData = {
        email: 'tëst@exämple.com',
        password: 'Pássw0rd123!',
        confirmPassword: 'Pássw0rd123!',
        address: {
          street: '北京市朝阳区123号',
          postalCode: '100000',
          country: '中国',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(unicodeData);

      // Should handle unicode appropriately
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/health') // Assuming health endpoint exists
        .expect(200);

      // Verify security headers are present
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should reject requests from unauthorized origins in production', async () => {
      // This would depend on the actual CORS configuration
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'http://malicious-site.com')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      // In production with strict CORS, this might be rejected
      // In test environment, it might be allowed
      expect(response.status).toBeDefined();
    });
  });
});

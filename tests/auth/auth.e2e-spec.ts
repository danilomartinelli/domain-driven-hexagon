import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { DatabaseModule } from '@libs/database/database.module';
import { AUTH_DI_TOKENS } from '@modules/auth/auth.di-tokens';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';
import { LoginHttpController } from '@modules/auth/commands/login/login.http.controller';
import { RegisterHttpController } from '@modules/auth/commands/register/register.http.controller';
import { RefreshTokenHttpController } from '@modules/auth/commands/refresh-token/refresh-token.http.controller';
import { LogoutHttpController } from '@modules/auth/commands/logout/logout.http.controller';
import { LoginService } from '@modules/auth/commands/login/login.service';
import { RegisterService } from '@modules/auth/commands/register/register.service';
import { RefreshTokenService } from '@modules/auth/commands/refresh-token/refresh-token.service';
import { LogoutService } from '@modules/auth/commands/logout/logout.service';
import { JwtService } from '@modules/auth/infrastructure/services/jwt.service';
import { PasswordService } from '@modules/auth/infrastructure/services/password.service';
import { JwtStrategy } from '@modules/auth/infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { PermissionsGuard } from '@modules/auth/infrastructure/guards/permissions.guard';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        DatabaseModule,
        CqrsModule,
        PassportModule,
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [
        LoginHttpController,
        RegisterHttpController,
        RefreshTokenHttpController,
        LogoutHttpController,
      ],
      providers: [
        LoginService,
        RegisterService,
        RefreshTokenService,
        LogoutService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        {
          provide: AUTH_DI_TOKENS.JwtService,
          useClass: JwtService,
        },
        {
          provide: AUTH_DI_TOKENS.PasswordService,
          useClass: PasswordService,
        },
        // Add mock repositories for testing
        {
          provide: USER_DI_TOKENS.UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findOneById: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.RefreshTokenRepository,
          useValue: {
            findByToken: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            revokeAllUserTokens: jest.fn(),
            revokeToken: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.RoleRepository,
          useValue: {
            findByName: jest.fn(),
            assignRoleToUser: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.AuthAuditLogRepository,
          useValue: {
            insert: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          country: 'United States',
          postalCode: '12345',
          street: '123 Main Street',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBeDefined();
    });

    it('should fail with weak password', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        address: {
          country: 'United States',
          postalCode: '12345',
          street: '123 Main Street',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail with password mismatch', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'DifferentPassword123!',
        address: {
          country: 'United States',
          postalCode: '12345',
          street: '123 Main Street',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail with invalid email format', async () => {
      const registerDto = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        address: {
          country: 'United States',
          postalCode: '12345',
          street: '123 Main Street',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      // Mock successful login
      const mockUser = {
        id: 'user-123',
        getProps: () => ({
          email: 'test@example.com',
          password: 'hashed-password',
          isActive: true,
          isEmailVerified: true,
          loginAttempts: 0,
          lockedUntil: null,
        }),
      };

      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      const passwordService = module.get(AUTH_DI_TOKENS.PasswordService);
      
      userRepository.findByEmail.mockResolvedValue({ isSome: () => true, unwrap: () => mockUser });
      passwordService.compare.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('tokenType', 'Bearer');
      expect(response.body).toHaveProperty('expiresIn');
    });

    it('should fail with invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      userRepository.findByEmail.mockResolvedValue({ isNone: () => true });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should fail with inactive account', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const mockUser = {
        id: 'user-123',
        getProps: () => ({
          email: 'test@example.com',
          password: 'hashed-password',
          isActive: false,
          isEmailVerified: true,
          loginAttempts: 0,
          lockedUntil: null,
        }),
      };

      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      userRepository.findByEmail.mockResolvedValue({ isSome: () => true, unwrap: () => mockUser });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should fail with locked account', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const mockUser = {
        id: 'user-123',
        getProps: () => ({
          email: 'test@example.com',
          password: 'hashed-password',
          isActive: true,
          isEmailVerified: true,
          loginAttempts: 5,
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        }),
      };

      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      userRepository.findByEmail.mockResolvedValue({ isSome: () => true, unwrap: () => mockUser });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(429);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshDto = {
        refreshToken: 'valid-refresh-token',
      };

      // Mock successful token refresh
      const mockTokenEntity = {
        isActive: true,
        userId: 'user-123',
        revoke: jest.fn(),
      };

      const mockUser = {
        id: 'user-123',
        getProps: () => ({
          email: 'test@example.com',
          isActive: true,
        }),
      };

      const refreshTokenRepository = module.get(AUTH_DI_TOKENS.RefreshTokenRepository);
      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      const jwtService = module.get(AUTH_DI_TOKENS.JwtService);

      refreshTokenRepository.findByToken.mockResolvedValue({ isSome: () => true, unwrap: () => mockTokenEntity });
      userRepository.findOneById.mockResolvedValue({ isSome: () => true, unwrap: () => mockUser });
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123', email: 'test@example.com' });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('tokenType', 'Bearer');
    });

    it('should fail with invalid refresh token', async () => {
      const refreshDto = {
        refreshToken: 'invalid-refresh-token',
      };

      const refreshTokenRepository = module.get(AUTH_DI_TOKENS.RefreshTokenRepository);
      refreshTokenRepository.findByToken.mockResolvedValue({ isNone: () => true });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const logoutDto = {
        refreshToken: 'valid-refresh-token',
      };

      // Create a mock JWT token for authentication
      const jwtService = module.get(AUTH_DI_TOKENS.JwtService);
      const accessToken = await jwtService.generateAccessToken({
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: [],
        tokenType: 'access',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(logoutDto)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should fail without authentication', async () => {
      const logoutDto = {
        refreshToken: 'valid-refresh-token',
      };

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send(logoutDto)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login endpoint', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      // Mock user not found for all attempts
      const userRepository = module.get(USER_DI_TOKENS.UserRepository);
      userRepository.findByEmail.mockResolvedValue({ isNone: () => true });

      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto);

        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429); // Too Many Requests
        }
      }
    });
  });

  describe('Input Validation', () => {
    it('should validate email format in login', async () => {
      const loginDto = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(400);
    });

    it('should validate password length in registration', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'short',
        confirmPassword: 'short',
        address: {
          country: 'US',
          postalCode: '12345',
          street: '123 Main St',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should validate required fields in registration', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        // Missing confirmPassword and address
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });
});
import { LoggerPort } from '@libs/ports/logger.port';
import { AUTH_DI_TOKENS } from '@modules/auth/auth.di-tokens';
import { LoginCommand } from '@modules/auth/commands/login/login.command';
import { LoginService } from '@modules/auth/commands/login/login.service';
import { AuthAuditLogRepositoryPort } from '@modules/auth/database/auth-audit-log.repository.port';
import { RefreshTokenRepositoryPort } from '@modules/auth/database/refresh-token.repository.port';
import {
  AccountInactiveError,
  AccountLockedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '@modules/auth/domain/auth.errors';
import { JwtServicePort } from '@modules/auth/domain/ports/jwt.service.port';
import { PasswordServicePort } from '@modules/auth/domain/ports/password.service.port';
import { UserRepositoryPort } from '@modules/user/database/user.repository.port';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';
import { Test, TestingModule } from '@nestjs/testing';
import { None, Some } from 'oxide.ts';

describe('LoginService', () => {
  let service: LoginService;
  let userRepository: jest.Mocked<UserRepositoryPort>;
  let jwtService: jest.Mocked<JwtServicePort>;
  let passwordService: jest.Mocked<PasswordServicePort>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepositoryPort>;
  let auditLogRepository: jest.Mocked<AuthAuditLogRepositoryPort>;
  let logger: jest.Mocked<LoggerPort>;

  const mockUser = {
    id: 'user-123',
    getProps: jest.fn().mockReturnValue({
      email: 'test@example.com',
      password: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    }),
    updateAuthProps: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        {
          provide: USER_DI_TOKENS.UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.JwtService,
          useValue: {
            generateTokenPair: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.PasswordService,
          useValue: {
            compare: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.RefreshTokenRepository,
          useValue: {
            insert: jest.fn(),
          },
        },
        {
          provide: AUTH_DI_TOKENS.AuthAuditLogRepository,
          useValue: {
            insert: jest.fn(),
          },
        },
        {
          provide: LoggerPort,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LoginService>(LoginService);
    userRepository = module.get(USER_DI_TOKENS.UserRepository);
    jwtService = module.get(AUTH_DI_TOKENS.JwtService);
    passwordService = module.get(AUTH_DI_TOKENS.PasswordService);
    refreshTokenRepository = module.get(AUTH_DI_TOKENS.RefreshTokenRepository);
    auditLogRepository = module.get(AUTH_DI_TOKENS.AuthAuditLogRepository);
    logger = module.get(LoggerPort);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validCommand = new LoginCommand({
      email: 'test@example.com',
      password: 'SecurePassword123!',
      ipAddress: '192.168.1.1',
      userAgent: 'test-agent',
    });

    it('should successfully login with valid credentials', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(Some(mockUser));
      passwordService.compare.mockResolvedValue(true);
      jwtService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isOk()).toBe(true);
      const tokenPair = result.unwrap();
      expect(tokenPair.accessToken).toBe('access-token');
      expect(tokenPair.refreshToken).toBe('refresh-token');
      expect(tokenPair.tokenType).toBe('Bearer');
      expect(tokenPair.expiresIn).toBe(900);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(passwordService.compare).toHaveBeenCalledWith(
        'SecurePassword123!',
        'hashed-password',
      );
      expect(mockUser.updateAuthProps).toHaveBeenCalledWith({
        loginAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: expect.any(Date),
      });
      expect(userRepository.update).toHaveBeenCalledWith(mockUser);
      expect(refreshTokenRepository.insert).toHaveBeenCalled();
      expect(auditLogRepository.insert).toHaveBeenCalled();
    });

    it('should fail with invalid email', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(None);

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
      expect(auditLogRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ getProps: expect.any(Function) }),
      );
    });

    it('should fail with locked account', async () => {
      // Arrange      const lockedUser = {        ...mockUser,        getProps: jest.fn().mockReturnValue({          ...mockUser.getProps(),          lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now        }),      };      userRepository.findByEmail.mockResolvedValue(Some(lockedUser));

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(AccountLockedError);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should fail with inactive account', async () => {
      // Arrange
      const inactiveUser = {
        ...mockUser,
        getProps: jest.fn().mockReturnValue({
          ...mockUser.getProps(),
          isActive: false,
        }),
      };
      userRepository.findByEmail.mockResolvedValue(Some(inactiveUser));

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(AccountInactiveError);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should fail with unverified email', async () => {
      // Arrange
      const unverifiedUser = {
        ...mockUser,
        getProps: jest.fn().mockReturnValue({
          ...mockUser.getProps(),
          isEmailVerified: false,
        }),
      };
      userRepository.findByEmail.mockResolvedValue(Some(unverifiedUser));

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(EmailNotVerifiedError);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should fail with incorrect password', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(Some(mockUser));
      passwordService.compare.mockResolvedValue(false);

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
      expect(mockUser.updateAuthProps).toHaveBeenCalledWith(
        expect.objectContaining({ loginAttempts: 1 }),
      );
      expect(userRepository.update).toHaveBeenCalledWith(mockUser);
    });

    it('should lock account after max failed attempts', async () => {
      // Arrange
      const userWithFailedAttempts = {
        ...mockUser,
        getProps: jest.fn().mockReturnValue({
          ...mockUser.getProps(),
          loginAttempts: 4, // One attempt away from lock
        }),
      };
      userRepository.findByEmail.mockResolvedValue(
        Some(userWithFailedAttempts),
      );
      passwordService.compare.mockResolvedValue(false);

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
      expect(userWithFailedAttempts.updateAuthProps).toHaveBeenCalledWith(
        expect.objectContaining({
          loginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });

    it('should handle missing password field', async () => {
      // Arrange
      const userWithoutPassword = {
        ...mockUser,
        getProps: jest.fn().mockReturnValue({
          ...mockUser.getProps(),
          password: undefined,
        }),
      };
      userRepository.findByEmail.mockResolvedValue(Some(userWithoutPassword));

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      userRepository.findByEmail.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.execute(validCommand);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        'Login command execution failed',
        expect.objectContaining({
          email: 'test@example.com',
          error: 'Database error',
        }),
      );
    });
  });
});

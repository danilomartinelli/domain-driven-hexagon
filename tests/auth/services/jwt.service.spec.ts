import { Test, TestingModule } from '@nestjs/testing';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@modules/auth/infrastructure/services/jwt.service';
import { JwtPayload } from '@modules/auth/domain/auth.types';
import { InvalidTokenError, TokenExpiredError } from '@modules/auth/domain/auth.errors';
import { LoggerPort } from '@libs/ports/logger.port';

describe('JwtService', () => {
  let service: JwtService;
  let nestJwtService: jest.Mocked<NestJwtService>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<LoggerPort>;

  const mockPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['user:read-own'],
    tokenType: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: NestJwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(),
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

    service = module.get<JwtService>(JwtService);
    nestJwtService = module.get(NestJwtService);
    configService = module.get(ConfigService);
    logger = module.get(LoggerPort);

    // Setup default config mock responses
    configService.getOrThrow
      .mockReturnValueOnce('access-token-secret') // JWT_ACCESS_TOKEN_SECRET
      .mockReturnValueOnce('refresh-token-secret'); // JWT_REFRESH_TOKEN_SECRET
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      // Assert
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_ACCESS_TOKEN_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_TOKEN_SECRET');
    });

    it('should throw error if secrets are not configured', async () => {
      // Arrange
      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration missing');
      });

      // Act & Assert
      expect(() => {
        new JwtService(nestJwtService, configService, logger);
      }).toThrow('Configuration missing');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', async () => {
      // Arrange
      nestJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      // Act
      const result = await service.generateTokenPair(mockPayload);

      // Assert
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900, // 15 minutes in seconds
        tokenType: 'Bearer',
      });
      expect(nestJwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle token generation errors', async () => {
      // Arrange
      nestJwtService.signAsync.mockRejectedValue(new Error('Token generation failed'));

      // Act & Assert
      await expect(service.generateTokenPair(mockPayload)).rejects.toThrow('Token generation failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate access token',
        expect.objectContaining({
          userId: 'user-123',
          error: 'Token generation failed',
        })
      );
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('access-token');

      // Act
      const result = await service.generateAccessToken(mockPayload);

      // Assert
      expect(result).toBe('access-token');
      expect(nestJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockPayload,
          tokenType: 'access',
          jti: expect.any(String),
        }),
        {
          secret: 'access-token-secret',
          expiresIn: '15m',
        }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Access token generated successfully',
        {
          userId: 'user-123',
          email: 'test@example.com',
        }
      );
    });

    it('should include unique JWT ID in token', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('access-token');

      // Act
      await service.generateAccessToken(mockPayload);
      const firstCall = nestJwtService.signAsync.mock.calls[0][0];

      await service.generateAccessToken(mockPayload);
      const secondCall = nestJwtService.signAsync.mock.calls[1][0];

      // Assert
      expect(firstCall.jti).toBeDefined();
      expect(secondCall.jti).toBeDefined();
      expect(firstCall.jti).not.toBe(secondCall.jti);
    });

    it('should handle signing errors', async () => {
      // Arrange
      nestJwtService.signAsync.mockRejectedValue(new Error('Signing failed'));

      // Act & Assert
      await expect(service.generateAccessToken(mockPayload)).rejects.toThrow('Signing failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate access token',
        expect.objectContaining({
          userId: 'user-123',
          error: 'Signing failed',
        })
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with minimal payload', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('refresh-token');

      // Act
      const result = await service.generateRefreshToken(mockPayload);

      // Assert
      expect(result).toBe('refresh-token');
      expect(nestJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          tokenType: 'refresh',
          jti: expect.any(String),
        }),
        {
          secret: 'refresh-token-secret',
          expiresIn: '30d',
        }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Refresh token generated successfully',
        {
          userId: 'user-123',
          email: 'test@example.com',
        }
      );
    });

    it('should not include roles and permissions in refresh token', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('refresh-token');

      // Act
      await service.generateRefreshToken(mockPayload);

      // Assert
      const callPayload = nestJwtService.signAsync.mock.calls[0][0];
      expect(callPayload).not.toHaveProperty('roles');
      expect(callPayload).not.toHaveProperty('permissions');
    });

    it('should handle signing errors', async () => {
      // Arrange
      nestJwtService.signAsync.mockRejectedValue(new Error('Signing failed'));

      // Act & Assert
      await expect(service.generateRefreshToken(mockPayload)).rejects.toThrow('Signing failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate refresh token',
        expect.objectContaining({
          userId: 'user-123',
          error: 'Signing failed',
        })
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      // Arrange
      const verifiedPayload = { ...mockPayload, tokenType: 'access' };
      nestJwtService.verifyAsync.mockResolvedValue(verifiedPayload);

      // Act
      const result = await service.verifyAccessToken('valid-token');

      // Assert
      expect(result).toEqual(verifiedPayload);
      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: 'access-token-secret',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Access token verified successfully',
        {
          userId: 'user-123',
          email: 'test@example.com',
        }
      );
    });

    it('should reject refresh token used as access token', async () => {
      // Arrange
      const refreshPayload = { ...mockPayload, tokenType: 'refresh' };
      nestJwtService.verifyAsync.mockResolvedValue(refreshPayload);

      // Act & Assert
      await expect(service.verifyAccessToken('refresh-token')).rejects.toThrow(InvalidTokenError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Access token verification failed',
        expect.objectContaining({
          error: 'Token is not an access token',
        })
      );
    });

    it('should handle expired tokens', async () => {
      // Arrange
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      nestJwtService.verifyAsync.mockRejectedValue(expiredError);

      // Act & Assert
      await expect(service.verifyAccessToken('expired-token')).rejects.toThrow(TokenExpiredError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Access token verification failed',
        expect.objectContaining({
          error: 'Token expired',
        })
      );
    });

    it('should handle invalid tokens', async () => {
      // Arrange
      nestJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow(InvalidTokenError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Access token verification failed',
        expect.objectContaining({
          error: 'Invalid token',
        })
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      // Arrange
      const verifiedPayload = { ...mockPayload, tokenType: 'refresh' };
      nestJwtService.verifyAsync.mockResolvedValue(verifiedPayload);

      // Act
      const result = await service.verifyRefreshToken('valid-refresh-token');

      // Assert
      expect(result).toEqual(verifiedPayload);
      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'refresh-token-secret',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Refresh token verified successfully',
        {
          userId: 'user-123',
          email: 'test@example.com',
        }
      );
    });

    it('should reject access token used as refresh token', async () => {
      // Arrange
      const accessPayload = { ...mockPayload, tokenType: 'access' };
      nestJwtService.verifyAsync.mockResolvedValue(accessPayload);

      // Act & Assert
      await expect(service.verifyRefreshToken('access-token')).rejects.toThrow(InvalidTokenError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Refresh token verification failed',
        expect.objectContaining({
          error: 'Token is not a refresh token',
        })
      );
    });

    it('should handle expired refresh tokens', async () => {
      // Arrange
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      nestJwtService.verifyAsync.mockRejectedValue(expiredError);

      // Act & Assert
      await expect(service.verifyRefreshToken('expired-refresh-token')).rejects.toThrow(TokenExpiredError);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Arrange
      nestJwtService.decode.mockReturnValue(mockPayload);

      // Act
      const result = service.decodeToken('token-to-decode');

      // Assert
      expect(result).toEqual(mockPayload);
      expect(nestJwtService.decode).toHaveBeenCalledWith('token-to-decode');
    });

    it('should return null for invalid tokens', () => {
      // Arrange
      nestJwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = service.decodeToken('invalid-token');

      // Assert
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Token decode failed',
        expect.objectContaining({
          error: 'Invalid token',
        })
      );
    });

    it('should handle null token', () => {
      // Arrange
      nestJwtService.decode.mockReturnValue(null);

      // Act
      const result = service.decodeToken('null-token');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      // Arrange
      const validPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      nestJwtService.decode.mockReturnValue(validPayload);

      // Act
      const result = service.isTokenExpired('valid-token');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      // Arrange
      const expiredPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      nestJwtService.decode.mockReturnValue(expiredPayload);

      // Act
      const result = service.isTokenExpired('expired-token');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for token without expiration', () => {
      // Arrange
      const payloadWithoutExp = { ...mockPayload };
      delete payloadWithoutExp.exp;
      nestJwtService.decode.mockReturnValue(payloadWithoutExp);

      // Act
      const result = service.isTokenExpired('token-without-exp');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for null decoded token', () => {
      // Arrange
      nestJwtService.decode.mockReturnValue(null);

      // Act
      const result = service.isTokenExpired('null-token');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for decode errors', () => {
      // Arrange
      nestJwtService.decode.mockImplementation(() => {
        throw new Error('Decode failed');
      });

      // Act
      const result = service.isTokenExpired('invalid-token');

      // Assert
      expect(result).toBe(true);
    });

    it('should handle edge case of exactly current timestamp', () => {
      // Arrange
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        ...mockPayload,
        exp: currentTime,
      };
      nestJwtService.decode.mockReturnValue(expiredPayload);

      // Act
      const result = service.isTokenExpired('edge-case-token');

      // Assert
      expect(result).toBe(true); // Token is considered expired at exactly current time
    });
  });

  describe('error handling', () => {
    it('should handle unknown errors gracefully', async () => {
      // Arrange
      nestJwtService.signAsync.mockRejectedValue('String error instead of Error object');

      // Act & Assert
      await expect(service.generateAccessToken(mockPayload)).rejects.toBe('String error instead of Error object');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate access token',
        expect.objectContaining({
          error: 'Unknown error',
        })
      );
    });

    it('should handle verification errors without name property', async () => {
      // Arrange
      const errorWithoutName = new Error('Some error');
      delete (errorWithoutName as any).name;
      nestJwtService.verifyAsync.mockRejectedValue(errorWithoutName);

      // Act & Assert
      await expect(service.verifyAccessToken('token')).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('security considerations', () => {
    it('should use different secrets for access and refresh tokens', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('token');

      // Act
      await service.generateAccessToken(mockPayload);
      await service.generateRefreshToken(mockPayload);

      // Assert
      expect(nestJwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          secret: 'access-token-secret',
        })
      );
      expect(nestJwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          secret: 'refresh-token-secret',
        })
      );
    });

    it('should enforce token type validation strictly', async () => {
      // Arrange
      const maliciousPayload = { ...mockPayload, tokenType: 'malicious' };
      nestJwtService.verifyAsync.mockResolvedValue(maliciousPayload);

      // Act & Assert
      await expect(service.verifyAccessToken('malicious-token')).rejects.toThrow(InvalidTokenError);
      await expect(service.verifyRefreshToken('malicious-token')).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('performance', () => {
    it('should generate tokens efficiently', async () => {
      // Arrange
      nestJwtService.signAsync.mockResolvedValue('fast-token');
      const startTime = Date.now();

      // Act
      await Promise.all([
        service.generateAccessToken(mockPayload),
        service.generateRefreshToken(mockPayload),
      ]);

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should decode tokens quickly', () => {
      // Arrange
      nestJwtService.decode.mockReturnValue(mockPayload);
      const startTime = Date.now();

      // Act
      for (let i = 0; i < 1000; i++) {
        service.decodeToken('token');
      }

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // 1000 operations in less than 100ms
    });
  });
});
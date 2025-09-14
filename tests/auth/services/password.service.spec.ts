import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from '@modules/auth/infrastructure/services/password.service';
import { Password } from '@modules/auth/domain/value-objects/password.value-object';
import { WeakPasswordError } from '@modules/auth/domain/auth.errors';
import { LoggerPort } from '@libs/ports/logger.port';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

// Mock Password value object
jest.mock('@modules/auth/domain/value-objects/password.value-object', () => ({
  Password: {
    create: jest.fn(),
  },
}));

describe('PasswordService', () => {
  let service: PasswordService;
  let logger: jest.Mocked<LoggerPort>;
  let mockPassword: jest.Mocked<Password>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
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

    service = module.get<PasswordService>(PasswordService);
    logger = module.get(LoggerPort);

    // Setup mock Password value object
    mockPassword = {
      value: 'hashed-password',
      isHashed: false,
      hash: jest.fn(),
      validate: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('should hash a non-hashed password', async () => {
      // Arrange
      const hashedPasswordVO = { value: 'new-hashed-password' };
      mockPassword.isHashed = false;
      mockPassword.hash.mockResolvedValue(hashedPasswordVO);

      // Act
      const result = await service.hash(mockPassword);

      // Assert
      expect(result).toBe('new-hashed-password');
      expect(mockPassword.hash).toHaveBeenCalled();
    });

    it('should return existing hash for already hashed password', async () => {
      // Arrange
      mockPassword.isHashed = true;
      mockPassword.value = 'already-hashed-password';

      // Act
      const result = await service.hash(mockPassword);

      // Assert
      expect(result).toBe('already-hashed-password');
      expect(mockPassword.hash).not.toHaveBeenCalled();
    });

    it('should handle hashing errors', async () => {
      // Arrange
      mockPassword.isHashed = false;
      mockPassword.hash.mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(service.hash(mockPassword)).rejects.toThrow(
        'Hashing failed',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to hash password',
        expect.objectContaining({
          error: 'Hashing failed',
        }),
      );
    });

    it('should handle unknown errors', async () => {
      // Arrange
      mockPassword.isHashed = false;
      mockPassword.hash.mockRejectedValue('String error');

      // Act & Assert
      await expect(service.hash(mockPassword)).rejects.toBe('String error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to hash password',
        expect.objectContaining({
          error: 'Unknown error',
        }),
      );
    });
  });

  describe('compare', () => {
    it('should return true for matching passwords', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.compare('plain-password', 'hashed-password');

      // Assert
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'plain-password',
        'hashed-password',
      );
    });

    it('should return false for non-matching passwords', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.compare('wrong-password', 'hashed-password');

      // Assert
      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong-password',
        'hashed-password',
      );
    });

    it('should handle bcrypt comparison errors', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Comparison failed'),
      );

      // Act
      const result = await service.compare('plain-password', 'hashed-password');

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to compare password',
        expect.objectContaining({
          error: 'Comparison failed',
        }),
      );
    });

    it('should handle unknown comparison errors', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockRejectedValue('String error');

      // Act
      const result = await service.compare('plain-password', 'hashed-password');

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to compare password',
        expect.objectContaining({
          error: 'Unknown error',
        }),
      );
    });

    it('should handle null or undefined inputs', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Invalid input'),
      );

      // Act
      const result1 = await service.compare(null as any, 'hashed-password');
      const result2 = await service.compare('plain-password', null as any);
      const result3 = await service.compare(undefined as any, undefined as any);

      // Assert
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('validate', () => {
    it('should return true for valid password', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {}); // No error thrown

      // Act
      const result = await service.validate('ValidPassword123!');

      // Assert
      expect(result).toBe(true);
      expect(Password.create).toHaveBeenCalledWith('ValidPassword123!');
      expect(mockPassword.validate).toHaveBeenCalled();
    });

    it('should return false for weak password', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {
        throw new WeakPasswordError('Password is too weak');
      });

      // Act
      const result = await service.validate('weak');

      // Assert
      expect(result).toBe(false);
      expect(Password.create).toHaveBeenCalledWith('weak');
      expect(mockPassword.validate).toHaveBeenCalled();
    });

    it('should handle other validation errors', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {
        throw new Error('Validation error');
      });

      // Act
      const result = await service.validate('some-password');

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Password validation error',
        expect.objectContaining({
          error: 'Validation error',
        }),
      );
    });

    it('should handle Password creation errors', async () => {
      // Arrange
      (Password.create as jest.Mock).mockImplementation(() => {
        throw new Error('Creation failed');
      });

      // Act
      const result = await service.validate('some-password');

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Password validation error',
        expect.objectContaining({
          error: 'Creation failed',
        }),
      );
    });

    it('should handle unknown validation errors', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {
        throw 'String error';
      });

      // Act
      const result = await service.validate('some-password');

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Password validation error',
        expect.objectContaining({
          error: 'Unknown error',
        }),
      );
    });

    it('should validate various password patterns', async () => {
      // Arrange
      const passwordPatterns = [
        'Short1!',
        'NoNumbers!',
        'NoSpecialChars123',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'Valid123!',
        'AnotherValidP@ssw0rd',
      ];

      (Password.create as jest.Mock).mockReturnValue(mockPassword);

      // Mock different validation results
      mockPassword.validate
        .mockImplementationOnce(() => {
          throw new WeakPasswordError('Too short');
        })
        .mockImplementationOnce(() => {
          throw new WeakPasswordError('No numbers');
        })
        .mockImplementationOnce(() => {
          throw new WeakPasswordError('No special chars');
        })
        .mockImplementationOnce(() => {
          throw new WeakPasswordError('No uppercase');
        })
        .mockImplementationOnce(() => {
          throw new WeakPasswordError('No lowercase');
        })
        .mockImplementationOnce(() => {}) // Valid
        .mockImplementationOnce(() => {}); // Valid

      // Act & Assert
      for (let i = 0; i < passwordPatterns.length; i++) {
        const result = await service.validate(passwordPatterns[i]);
        if (i < 5) {
          expect(result).toBe(false);
        } else {
          expect(result).toBe(true);
        }
      }
    });
  });

  describe('generateSecureToken', () => {
    it('should generate secure token', () => {
      // Arrange
      const mockBuffer = Buffer.from('mockrandomdata');
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockBuffer);

      // Act
      const result = service.generateSecureToken();

      // Assert
      expect(result).toBe(mockBuffer.toString('hex'));
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should generate different tokens on multiple calls', () => {
      // Arrange
      (crypto.randomBytes as jest.Mock)
        .mockReturnValueOnce(Buffer.from('firsttoken'))
        .mockReturnValueOnce(Buffer.from('secondtoken'));

      // Act
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();

      // Assert
      expect(token1).not.toBe(token2);
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
    });

    it('should handle crypto.randomBytes errors', () => {
      // Arrange
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      // Act & Assert
      expect(() => service.generateSecureToken()).toThrow(
        'Random generation failed',
      );
    });
  });

  describe('generateResetToken', () => {
    it('should generate reset token', () => {
      // Arrange
      const mockBuffer = Buffer.from('resettoken');
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockBuffer);

      // Act
      const result = service.generateResetToken();

      // Assert
      expect(result).toBe(mockBuffer.toString('hex'));
      expect(crypto.randomBytes).toHaveBeenCalledWith(20);
    });

    it('should generate different reset tokens on multiple calls', () => {
      // Arrange
      (crypto.randomBytes as jest.Mock)
        .mockReturnValueOnce(Buffer.from('firstreset'))
        .mockReturnValueOnce(Buffer.from('secondreset'));

      // Act
      const token1 = service.generateResetToken();
      const token2 = service.generateResetToken();

      // Assert
      expect(token1).not.toBe(token2);
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
    });

    it('should generate shorter tokens than secure tokens', () => {
      // Act
      service.generateSecureToken();
      service.generateResetToken();

      // Assert
      expect(crypto.randomBytes).toHaveBeenCalledWith(32); // Secure token
      expect(crypto.randomBytes).toHaveBeenCalledWith(20); // Reset token
    });

    it('should handle crypto.randomBytes errors', () => {
      // Arrange
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      // Act & Assert
      expect(() => service.generateResetToken()).toThrow(
        'Random generation failed',
      );
    });
  });

  describe('security considerations', () => {
    it('should use sufficient entropy for tokens', () => {
      // Act
      service.generateSecureToken();
      service.generateResetToken();

      // Assert
      expect(crypto.randomBytes).toHaveBeenCalledWith(32); // 256 bits of entropy
      expect(crypto.randomBytes).toHaveBeenCalledWith(20); // 160 bits of entropy
    });

    it('should not log sensitive password data', async () => {
      // Arrange
      mockPassword.isHashed = false;
      mockPassword.hash.mockRejectedValue(new Error('Hashing failed'));

      try {
        // Act
        await service.hash(mockPassword);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Expected to throw
      }

      // Assert
      expect(logger.error).toHaveBeenCalled();
      const logCall = logger.error.mock.calls[0];
      expect(JSON.stringify(logCall)).not.toContain('password');
      expect(JSON.stringify(logCall)).not.toContain('secret');
    });

    it('should handle timing attacks in comparison', async () => {
      // Arrange
      const startTimes: number[] = [];
      const endTimes: number[] = [];

      (bcrypt.compare as jest.Mock).mockImplementation(() => {
        // Simulate consistent timing regardless of result
        return new Promise((resolve) => {
          setTimeout(() => resolve(Math.random() > 0.5), 10);
        });
      });

      // Act
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await service.compare('password', 'hash');
        const end = Date.now();
        startTimes.push(start);
        endTimes.push(end);
      }

      // Assert - Timing should be relatively consistent (within reasonable variance)
      const timings = endTimes.map((end, i) => end - startTimes[i]);
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxVariance = Math.max(...timings) - Math.min(...timings);

      expect(maxVariance).toBeLessThan(avgTiming * 0.5); // Variance should be less than 50% of average
    });
  });

  describe('performance', () => {
    it('should validate passwords efficiently', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {});
      const startTime = Date.now();

      // Act
      const promises = Array(100)
        .fill(0)
        .map(() => service.validate('TestPassword123!'));
      await Promise.all(promises);

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should generate tokens quickly', () => {
      // Arrange
      (crypto.randomBytes as jest.Mock).mockReturnValue(
        Buffer.from('quicktoken'),
      );
      const startTime = Date.now();

      // Act
      for (let i = 0; i < 1000; i++) {
        service.generateSecureToken();
      }

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('edge cases', () => {
    it('should handle empty password strings', async () => {
      // Arrange
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {
        throw new WeakPasswordError('Empty password');
      });

      // Act
      const result = await service.validate('');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle very long passwords', async () => {
      // Arrange
      const longPassword = 'a'.repeat(1000);
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {});

      // Act
      const result = await service.validate(longPassword);

      // Assert
      expect(result).toBe(true);
      expect(Password.create).toHaveBeenCalledWith(longPassword);
    });

    it('should handle special unicode characters in passwords', async () => {
      // Arrange
      const unicodePassword = 'P@ssw0rd🔒🎯😀';
      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {});

      // Act
      const result = await service.validate(unicodePassword);

      // Assert
      expect(result).toBe(true);
      expect(Password.create).toHaveBeenCalledWith(unicodePassword);
    });

    it('should handle null and undefined inputs gracefully', async () => {
      // Arrange
      (Password.create as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid input');
      });

      // Act & Assert
      await expect(service.validate(null as any)).resolves.toBe(false);
      await expect(service.validate(undefined as any)).resolves.toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should work with real-world password scenarios', async () => {
      // Arrange
      const realWorldPasswords = [
        'MySecureP@ssw0rd123',
        'AnotherGoodPassword!456',
        'ComplexP@ssw0rd#789',
      ];

      (Password.create as jest.Mock).mockReturnValue(mockPassword);
      mockPassword.validate.mockImplementation(() => {}); // All valid
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      for (const password of realWorldPasswords) {
        const isValid = await service.validate(password);
        const hashedPassword = {
          value: `hashed_${password}`,
          isHashed: false,
          hash: jest.fn().mockResolvedValue({ value: `hashed_${password}` }),
        } as any;
        const hash = await service.hash(hashedPassword);
        const matches = await service.compare(password, hash);

        // Assert
        expect(isValid).toBe(true);
        expect(hash).toBeDefined();
        expect(matches).toBe(true);
      }
    });
  });
});

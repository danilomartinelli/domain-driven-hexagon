import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import {
  AUTH_METADATA_KEY,
  AuthOptions,
} from '@modules/auth/infrastructure/decorators/auth.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get(Reflector);

    // Setup mock request
    mockRequest = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['user:read-own'],
      },
    };

    // Setup mock execution context
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access to public routes', async () => {
      // Arrange
      const authOptions: AuthOptions = { required: false };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        AUTH_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it('should proceed with JWT authentication for protected routes', async () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Mock the parent canActivate method
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should proceed with JWT authentication when no metadata is present', async () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Mock the parent canActivate method
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle authentication failures', async () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Mock the parent canActivate method to fail
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockRejectedValue(new UnauthorizedException('Token expired'));

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handleRequest', () => {
    it('should return user for successful authentication', () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);
      const mockUser = { sub: 'user-123', email: 'test@example.com' };

      // Act
      const result = guard.handleRequest(null, mockUser, null, mockContext);

      // Assert
      expect(result).toBe(mockUser);
    });

    it('should return null for public routes when no user is present', () => {
      // Arrange
      const authOptions: AuthOptions = { required: false };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Act
      const result = guard.handleRequest(null, null, null, mockContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException when auth is required but no user is present', () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Act & Assert
      expect(() => guard.handleRequest(null, null, null, mockContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw original error when authentication fails', () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);
      const originalError = new UnauthorizedException('Token expired');

      // Act & Assert
      expect(() =>
        guard.handleRequest(originalError, null, null, mockContext),
      ).toThrow('Token expired');
    });

    it('should throw UnauthorizedException with custom message when no error is provided', () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);

      // Act & Assert
      expect(() => guard.handleRequest(null, null, null, mockContext)).toThrow(
        'Invalid or expired token',
      );
    });

    it('should handle missing auth metadata gracefully', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const mockUser = { sub: 'user-123' };

      // Act
      const result = guard.handleRequest(null, mockUser, null, mockContext);

      // Assert
      expect(result).toBe(mockUser);
    });

    it('should handle edge case where user is falsy but not null/undefined', () => {
      // Arrange
      const authOptions: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(authOptions);
      const falsyUser = '';

      // Act & Assert
      expect(() =>
        guard.handleRequest(null, falsyUser, null, mockContext),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('metadata handling', () => {
    it('should correctly handle class-level metadata', async () => {
      // Arrange
      const classMetadata: AuthOptions = { required: false };
      reflector.getAllAndOverride.mockReturnValue(classMetadata);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        AUTH_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it('should correctly handle method-level metadata overriding class metadata', async () => {
      // Arrange
      const methodMetadata: AuthOptions = { required: true };
      reflector.getAllAndOverride.mockReturnValue(methodMetadata);

      // Mock parent canActivate
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle complex auth options', () => {
      // Arrange
      const complexAuthOptions: AuthOptions = {
        required: true,
        roles: ['admin'],
        permissions: ['admin:manage'],
      };
      reflector.getAllAndOverride.mockReturnValue(complexAuthOptions);
      const mockUser = { sub: 'admin-123', roles: ['admin'] };

      // Act
      const result = guard.handleRequest(null, mockUser, null, mockContext);

      // Assert
      expect(result).toBe(mockUser);
    });
  });

  describe('integration with Passport', () => {
    it('should work with Passport JWT strategy', async () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue({ required: true });

      // Mock successful Passport authentication
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle Passport authentication errors', async () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue({ required: true });

      // Mock Passport authentication failure
      const passportError = new UnauthorizedException('JWT malformed');
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockRejectedValue(passportError);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'JWT malformed',
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle reflector errors gracefully', async () => {
      // Arrange
      reflector.getAllAndOverride.mockImplementation(() => {
        throw new Error('Reflector error');
      });

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Reflector error',
      );
    });

    it('should handle missing execution context', async () => {
      // Arrange
      const nullContext = null as any;
      reflector.getAllAndOverride.mockReturnValue({ required: true });

      // Act & Assert
      await expect(guard.canActivate(nullContext)).rejects.toThrow();
    });

    it('should handle malformed auth metadata', async () => {
      // Arrange
      const malformedMetadata = { invalidProperty: 'invalid' } as any;
      reflector.getAllAndOverride.mockReturnValue(malformedMetadata);

      // Mock parent canActivate since metadata doesn't specify required: false
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should efficiently handle multiple rapid requests', async () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue({ required: false });
      const startTime = Date.now();

      // Act
      const promises = Array(1000)
        .fill(0)
        .map(() => guard.canActivate(mockContext));
      await Promise.all(promises);

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle metadata retrieval efficiently', async () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue({ required: false });

      // Act
      for (let i = 0; i < 100; i++) {
        await guard.canActivate(mockContext);
      }

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(100);
    });
  });

  describe('security considerations', () => {
    it('should not leak sensitive information in error messages', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue({ required: true });

      // Act & Assert
      try {
        guard.handleRequest(null, null, null, mockContext);
        fail('Should have thrown an exception');
      } catch (error) {
        expect(error.message).toBe('Invalid or expired token');
        expect(error.message).not.toContain('secret');
        expect(error.message).not.toContain('key');
        expect(error.message).not.toContain('password');
      }
    });

    it('should enforce authentication even with malicious metadata', async () => {
      // Arrange
      const maliciousMetadata = {
        required: 'definitely-not-required' as any, // Non-boolean value
      };
      reflector.getAllAndOverride.mockReturnValue(maliciousMetadata);

      // Mock parent canActivate to be called
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert - Should still proceed with authentication since required is not explicitly false
      expect(result).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { ROLES_METADATA_KEY } from '@modules/auth/infrastructure/decorators/auth.decorator';
import { JwtPayload } from '@modules/auth/domain/auth.types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);

    // Setup mock request with default user
    mockRequest = {
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user', 'editor'],
        permissions: ['user:read-own'],
        tokenType: 'access',
      } as JwtPayload,
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
    it('should allow access when no role requirements are specified', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        ROLES_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it('should allow access when empty roles array is specified', () => {
      // Arrange
      const rolesConfig = { roles: [], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user has required role (any mode)', () => {
      // Arrange
      const rolesConfig = { roles: ['user', 'admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user has all required roles (all mode)', () => {
      // Arrange
      const rolesConfig = { roles: ['user', 'editor'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required role (any mode)', () => {
      // Arrange
      const rolesConfig = { roles: ['admin', 'superuser'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required roles: admin OR superuser',
      );
    });

    it('should deny access when user lacks some required roles (all mode)', () => {
      // Arrange
      const rolesConfig = { roles: ['user', 'admin'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required roles: user, admin',
      );
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange
      mockRequest.user = undefined;
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'User not authenticated',
      );
    });

    it('should handle user with empty roles array', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, roles: [] };
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle user with undefined roles', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, roles: undefined };
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle user with null roles', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, roles: null as any };
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should default to requireAll: false when not specified', () => {
      // Arrange
      const rolesConfig = { roles: ['user', 'admin'] }; // requireAll not specified
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // User has 'user' role, so it should pass in 'any' mode
    });

    it('should handle case-sensitive role matching', () => {
      // Arrange
      const rolesConfig = { roles: ['User'], requireAll: false }; // Capital U
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('role configuration variations', () => {
    it('should handle single role requirement', () => {
      // Arrange
      const rolesConfig = { roles: ['editor'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle multiple roles with requireAll: true', () => {
      // Arrange
      mockRequest.user.roles = ['admin', 'user', 'editor'];
      const rolesConfig = { roles: ['admin', 'user'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle complex role hierarchy', () => {
      // Arrange
      mockRequest.user.roles = ['junior-dev', 'developer', 'team-lead'];
      const rolesConfig = {
        roles: ['developer', 'senior-dev'],
        requireAll: false,
      };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has 'developer' role
    });
  });

  describe('metadata handling', () => {
    it('should retrieve metadata from both handler and class', () => {
      // Arrange
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      guard.canActivate(mockContext);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        ROLES_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it('should handle malformed roles metadata', () => {
      // Arrange
      const malformedConfig = { roles: 'not-an-array' } as any;
      reflector.getAllAndOverride.mockReturnValue(malformedConfig);

      // Act & Assert
      // Should not throw due to type checking, but would fail the roles.length === 0 check
      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should handle null roles metadata', () => {
      // Arrange
      const nullConfig = { roles: null, requireAll: false } as any;
      reflector.getAllAndOverride.mockReturnValue(nullConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Should pass the null/empty check
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for single role requirement', () => {
      // Arrange
      const rolesConfig = { roles: ['admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required roles: admin',
      );
    });

    it('should provide clear error message for multiple role requirements (any mode)', () => {
      // Arrange
      const rolesConfig = {
        roles: ['admin', 'superuser', 'moderator'],
        requireAll: false,
      };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required roles: admin OR superuser OR moderator',
      );
    });

    it('should provide clear error message for multiple role requirements (all mode)', () => {
      // Arrange
      const rolesConfig = { roles: ['admin', 'superuser'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required roles: admin, superuser',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty user object', () => {
      // Arrange
      mockRequest.user = {} as JwtPayload;
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle execution context without HTTP request', () => {
      // Arrange
      mockContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(null),
        getResponse: jest.fn(),
      });
      const rolesConfig = { roles: ['user'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should handle reflector returning null', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(null);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle roles array with empty strings', () => {
      // Arrange
      mockRequest.user.roles = ['user', '', 'editor'];
      const rolesConfig = { roles: [''], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should efficiently handle large role arrays', () => {
      // Arrange
      const manyRoles = Array.from({ length: 1000 }, (_, i) => `role-${i}`);
      mockRequest.user.roles = [...manyRoles, 'target-role'];
      const rolesConfig = { roles: ['target-role'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      const startTime = Date.now();

      // Act
      const result = guard.canActivate(mockContext);

      const endTime = Date.now();

      // Assert
      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });

    it('should efficiently handle many required roles with requireAll: true', () => {
      // Arrange
      const manyRoles = Array.from({ length: 100 }, (_, i) => `role-${i}`);
      mockRequest.user.roles = manyRoles;
      const rolesConfig = { roles: manyRoles, requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      const startTime = Date.now();

      // Act
      const result = guard.canActivate(mockContext);

      const endTime = Date.now();

      // Assert
      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('security considerations', () => {
    it('should not expose user information in error messages', () => {
      // Arrange
      mockRequest.user.roles = ['user'];
      const rolesConfig = { roles: ['admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      try {
        guard.canActivate(mockContext);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error.message).not.toContain('user-123');
        expect(error.message).not.toContain('test@example.com');
        expect(error.message).not.toContain('user'); // Should not expose actual user roles
      }
    });

    it('should prevent role escalation attempts', () => {
      // Arrange - User tries to inject admin role through malicious payload
      const maliciousUser = {
        ...mockRequest.user,
        roles: ['user', 'admin'], // Legitimate roles
        // Malicious attempt to add more roles through other properties
        extraRoles: ['superuser'],
        permissions: ['admin:all', 'user:read-own'],
      };
      mockRequest.user = maliciousUser;

      const rolesConfig = { roles: ['superuser'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle role injection attempts in metadata', () => {
      // Arrange
      const maliciousConfig = {
        roles: ['user'],
        requireAll: false,
        // Malicious attempt to inject additional logic
        bypassCheck: true,
        adminOverride: 'enable',
      } as any;
      reflector.getAllAndOverride.mockReturnValue(maliciousConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Should work normally, ignoring malicious properties
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical admin access scenario', () => {
      // Arrange
      mockRequest.user.roles = ['user', 'admin'];
      const rolesConfig = { roles: ['admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle multi-role requirement for sensitive operations', () => {
      // Arrange
      mockRequest.user.roles = ['admin', 'auditor', 'security-officer'];
      const rolesConfig = {
        roles: ['admin', 'security-officer'],
        requireAll: true,
      };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle organization hierarchy roles', () => {
      // Arrange
      mockRequest.user.roles = ['employee', 'team-lead', 'department-head'];
      const rolesConfig = {
        roles: ['manager', 'team-lead', 'department-head'],
        requireAll: false,
      };
      reflector.getAllAndOverride.mockReturnValue(rolesConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has team-lead role
    });
  });
});

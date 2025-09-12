import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@modules/auth/infrastructure/guards/permissions.guard';
import { PERMISSIONS_METADATA_KEY } from '@modules/auth/infrastructure/decorators/auth.decorator';
import { JwtPayload } from '@modules/auth/domain/auth.types';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get(Reflector);

    // Setup mock request with default user
    mockRequest = {
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['user:read-own', 'user:update-own', 'post:create'],
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
    it('should allow access when no permission requirements are specified', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        PERMISSIONS_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()]
      );
    });

    it('should allow access when empty permissions array is specified', () => {
      // Arrange
      const permissionsConfig = { permissions: [], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user has required permission (any mode)', () => {
      // Arrange
      const permissionsConfig = { permissions: ['user:read-own', 'admin:manage'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user has all required permissions (all mode)', () => {
      // Arrange
      const permissionsConfig = { permissions: ['user:read-own', 'post:create'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required permission (any mode)', () => {
      // Arrange
      const permissionsConfig = { permissions: ['admin:manage', 'super:admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required permissions: admin:manage OR super:admin'
      );
    });

    it('should deny access when user lacks some required permissions (all mode)', () => {
      // Arrange
      const permissionsConfig = { permissions: ['user:read-own', 'admin:manage'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required permissions: user:read-own, admin:manage'
      );
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange
      mockRequest.user = undefined;
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('User not authenticated');
    });

    it('should handle user with empty permissions array', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, permissions: [] };
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle user with undefined permissions', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, permissions: undefined };
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle user with null permissions', () => {
      // Arrange
      mockRequest.user = { ...mockRequest.user, permissions: null as any };
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should default to requireAll: false when not specified', () => {
      // Arrange
      const permissionsConfig = { permissions: ['user:read-own', 'admin:manage'] }; // requireAll not specified
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // User has 'user:read-own' permission
    });

    it('should handle case-sensitive permission matching', () => {
      // Arrange
      const permissionsConfig = { permissions: ['User:Read-Own'], requireAll: false }; // Different case
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('permission configuration variations', () => {
    it('should handle single permission requirement', () => {
      // Arrange
      const permissionsConfig = { permissions: ['post:create'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle multiple permissions with requireAll: true', () => {
      // Arrange
      mockRequest.user.permissions = ['user:read-own', 'user:update-own', 'post:create', 'post:update'];
      const permissionsConfig = { permissions: ['user:read-own', 'post:create'], requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle hierarchical permission patterns', () => {
      // Arrange
      mockRequest.user.permissions = ['organization:read', 'team:manage', 'user:read-own'];
      const permissionsConfig = { permissions: ['organization:read', 'company:admin'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has 'organization:read' permission
    });

    it('should handle CRUD permission patterns', () => {
      // Arrange
      mockRequest.user.permissions = ['post:create', 'post:read', 'post:update'];
      const permissionsConfig = { permissions: ['post:delete', 'post:read'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has 'post:read' permission
    });
  });

  describe('metadata handling', () => {
    it('should retrieve metadata from both handler and class', () => {
      // Arrange
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      guard.canActivate(mockContext);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        PERMISSIONS_METADATA_KEY,
        [mockContext.getHandler(), mockContext.getClass()]
      );
    });

    it('should handle malformed permissions metadata', () => {
      // Arrange
      const malformedConfig = { permissions: 'not-an-array' } as any;
      reflector.getAllAndOverride.mockReturnValue(malformedConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should handle null permissions metadata', () => {
      // Arrange
      const nullConfig = { permissions: null, requireAll: false } as any;
      reflector.getAllAndOverride.mockReturnValue(nullConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for single permission requirement', () => {
      // Arrange
      const permissionsConfig = { permissions: ['admin:manage'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required permissions: admin:manage'
      );
    });

    it('should provide clear error message for multiple permission requirements (any mode)', () => {
      // Arrange
      const permissionsConfig = { 
        permissions: ['admin:manage', 'super:admin', 'system:control'], 
        requireAll: false 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required permissions: admin:manage OR super:admin OR system:control'
      );
    });

    it('should provide clear error message for multiple permission requirements (all mode)', () => {
      // Arrange
      const permissionsConfig = { 
        permissions: ['admin:manage', 'audit:access'], 
        requireAll: true 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Access denied. Required permissions: admin:manage, audit:access'
      );
    });
  });

  describe('complex permission scenarios', () => {
    it('should handle resource-specific permissions', () => {
      // Arrange
      mockRequest.user.permissions = [
        'user:123:read',
        'user:123:update',
        'post:456:read',
        'organization:789:manage'
      ];
      const permissionsConfig = { permissions: ['user:123:update'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle wildcard-style permissions', () => {
      // Arrange
      mockRequest.user.permissions = ['user:*:read', 'post:own:*', 'admin:system:config'];
      const permissionsConfig = { permissions: ['user:*:read', 'admin:users:manage'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has 'user:*:read' permission
    });

    it('should handle contextual permissions', () => {
      // Arrange
      mockRequest.user.permissions = [
        'document:own:read',
        'document:team:read',
        'document:own:write',
        'comment:any:create'
      ];
      const permissionsConfig = { 
        permissions: ['document:team:write', 'document:own:write'], 
        requireAll: false 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has 'document:own:write' permission
    });
  });

  describe('edge cases', () => {
    it('should handle empty user object', () => {
      // Arrange
      mockRequest.user = {} as JwtPayload;
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle execution context without HTTP request', () => {
      // Arrange
      mockContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(null),
        getResponse: jest.fn(),
      });
      const permissionsConfig = { permissions: ['user:read-own'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

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

    it('should handle permissions array with empty strings', () => {
      // Arrange
      mockRequest.user.permissions = ['user:read-own', '', 'post:create'];
      const permissionsConfig = { permissions: [''], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle very long permission strings', () => {
      // Arrange
      const longPermission = 'very:long:permission:'.repeat(100) + 'read';
      mockRequest.user.permissions = [longPermission];
      const permissionsConfig = { permissions: [longPermission], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should efficiently handle large permission arrays', () => {
      // Arrange
      const manyPermissions = Array.from({ length: 1000 }, (_, i) => `resource:${i}:read`);
      mockRequest.user.permissions = [...manyPermissions, 'target:permission:access'];
      const permissionsConfig = { permissions: ['target:permission:access'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);
      
      const startTime = Date.now();

      // Act
      const result = guard.canActivate(mockContext);

      const endTime = Date.now();

      // Assert
      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should efficiently handle many required permissions with requireAll: true', () => {
      // Arrange
      const manyPermissions = Array.from({ length: 100 }, (_, i) => `permission:${i}:access`);
      mockRequest.user.permissions = manyPermissions;
      const permissionsConfig = { permissions: manyPermissions, requireAll: true };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);
      
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
      mockRequest.user.permissions = ['user:read-own'];
      const permissionsConfig = { permissions: ['admin:manage'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      try {
        guard.canActivate(mockContext);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error.message).not.toContain('user-123');
        expect(error.message).not.toContain('test@example.com');
        expect(error.message).not.toContain('user:read-own'); // Should not expose actual permissions
      }
    });

    it('should prevent permission escalation attempts', () => {
      // Arrange
      const maliciousUser = {
        ...mockRequest.user,
        permissions: ['user:read-own', 'post:create'],
        // Malicious attempt to add more permissions
        extraPermissions: ['admin:manage'],
        roles: ['user', 'admin'], // Even if user has admin role, permissions should be checked
      };
      mockRequest.user = maliciousUser;
      
      const permissionsConfig = { permissions: ['admin:manage'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle permission injection attempts in metadata', () => {
      // Arrange
      const maliciousConfig = {
        permissions: ['user:read-own'],
        requireAll: false,
        // Malicious attempt to inject additional logic
        bypassPermissions: true,
        adminOverride: 'enable',
      } as any;
      reflector.getAllAndOverride.mockReturnValue(maliciousConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Should work normally, ignoring malicious properties
    });

    it('should validate permission format consistency', () => {
      // Arrange - Test with various permission formats
      const permissionFormats = [
        'simple-permission',
        'resource:action',
        'resource:id:action',
        'namespace:resource:id:action',
        'very:deeply:nested:resource:specific:action'
      ];
      
      mockRequest.user.permissions = permissionFormats;
      
      permissionFormats.forEach(permission => {
        const permissionsConfig = { permissions: [permission], requireAll: false };
        reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

        // Act
        const result = guard.canActivate(mockContext);

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  describe('real-world permission scenarios', () => {
    it('should handle typical user access control', () => {
      // Arrange
      mockRequest.user.permissions = [
        'profile:own:read',
        'profile:own:update',
        'posts:own:create',
        'posts:own:update',
        'comments:any:create'
      ];
      const permissionsConfig = { permissions: ['profile:own:update'], requireAll: false };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle admin dashboard access', () => {
      // Arrange
      mockRequest.user.permissions = [
        'dashboard:admin:view',
        'users:admin:read',
        'users:admin:update',
        'system:admin:configure',
        'reports:admin:generate'
      ];
      const permissionsConfig = { 
        permissions: ['dashboard:admin:view', 'users:admin:read'], 
        requireAll: true 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle multi-tenant permissions', () => {
      // Arrange
      mockRequest.user.permissions = [
        'tenant:org-123:admin',
        'tenant:org-123:billing:manage',
        'tenant:org-456:member',
        'global:support:access'
      ];
      const permissionsConfig = { 
        permissions: ['tenant:org-123:billing:manage', 'tenant:org-789:admin'], 
        requireAll: false 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has tenant:org-123:billing:manage
    });

    it('should handle API endpoint specific permissions', () => {
      // Arrange
      mockRequest.user.permissions = [
        'api:users:get',
        'api:users:post',
        'api:posts:get',
        'api:comments:get'
      ];
      const permissionsConfig = { 
        permissions: ['api:users:put', 'api:users:post'], 
        requireAll: false 
      };
      reflector.getAllAndOverride.mockReturnValue(permissionsConfig);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true); // Has api:users:post
    });
  });
});
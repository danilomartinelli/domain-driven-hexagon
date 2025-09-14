import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  RateLimit,
  AuthRateLimit,
  ApiRateLimit,
  UploadRateLimit,
  SearchRateLimit,
  PasswordResetRateLimit,
  EmailRateLimit,
  AdminRateLimit,
  PublicApiRateLimit,
  UserProfileRateLimit,
  HeavyOperationRateLimit,
  CustomRateLimit,
  UserBasedRateLimit,
  RateLimitWithMessage,
  RATE_LIMIT_METADATA,
} from '@libs/security/rate-limiting.decorator';

// Mock controller for testing decorators
class TestController {
  @AuthRateLimit()
  authEndpoint() {
    return 'auth';
  }

  @ApiRateLimit()
  apiEndpoint() {
    return 'api';
  }

  @UploadRateLimit()
  uploadEndpoint() {
    return 'upload';
  }

  @SearchRateLimit()
  searchEndpoint() {
    return 'search';
  }

  @PasswordResetRateLimit()
  passwordResetEndpoint() {
    return 'password-reset';
  }

  @EmailRateLimit()
  emailEndpoint() {
    return 'email';
  }

  @AdminRateLimit()
  adminEndpoint() {
    return 'admin';
  }

  @PublicApiRateLimit()
  publicApiEndpoint() {
    return 'public';
  }

  @UserProfileRateLimit()
  userProfileEndpoint() {
    return 'user-profile';
  }

  @HeavyOperationRateLimit()
  heavyOperationEndpoint() {
    return 'heavy-operation';
  }

  @CustomRateLimit(
    { ttl: 120, limit: 20 },
    { message: 'Custom rate limit exceeded' },
  )
  customRateLimitEndpoint() {
    return 'custom';
  }

  @UserBasedRateLimit({ ttl: 60, limit: 10 })
  userBasedEndpoint() {
    return 'user-based';
  }

  @RateLimitWithMessage(
    { ttl: 300, limit: 5 },
    'Too many requests. Please try again later.',
  )
  messageEndpoint() {
    return 'message';
  }

  @RateLimit({ ttl: 60, limit: 100 })
  basicRateLimitEndpoint() {
    return 'basic';
  }
}

describe('Rate Limiting Decorators', () => {
  let controller: TestController;
  let reflector: Reflector;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000, // 1 minute in milliseconds
            limit: 10,
          },
        ]),
      ],
      controllers: [TestController],
    }).compile();

    controller = module.get<TestController>(TestController);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Basic Rate Limiting', () => {
    it('should apply RateLimit decorator with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.basicRateLimitEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 60 seconds in milliseconds
      expect(metadata.default.limit).toBe(100);
    });

    it('should create rate limit configuration correctly', () => {
      // Arrange
      const config = { ttl: 120, limit: 50 };

      // Act
      const decorator = RateLimit(config);

      // Assert
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });
  });

  describe('Predefined Rate Limit Decorators', () => {
    it('should apply AuthRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.authEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 1 minute in milliseconds
      expect(metadata.default.limit).toBe(5);
    });

    it('should apply ApiRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.apiEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 1 minute in milliseconds
      expect(metadata.default.limit).toBe(100);
    });

    it('should apply UploadRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.uploadEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(300000); // 5 minutes in milliseconds
      expect(metadata.default.limit).toBe(10);
    });

    it('should apply SearchRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.searchEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 1 minute in milliseconds
      expect(metadata.default.limit).toBe(50);
    });

    it('should apply PasswordResetRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.passwordResetEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(900000); // 15 minutes in milliseconds
      expect(metadata.default.limit).toBe(3);
    });

    it('should apply EmailRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.emailEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(3600000); // 1 hour in milliseconds
      expect(metadata.default.limit).toBe(5);
    });

    it('should apply AdminRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.adminEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(300000); // 5 minutes in milliseconds
      expect(metadata.default.limit).toBe(20);
    });

    it('should apply PublicApiRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.publicApiEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(3600000); // 1 hour in milliseconds
      expect(metadata.default.limit).toBe(1000);
    });

    it('should apply UserProfileRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.userProfileEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 1 minute in milliseconds
      expect(metadata.default.limit).toBe(30);
    });

    it('should apply HeavyOperationRateLimit with correct configuration', () => {
      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.heavyOperationEndpoint,
      );

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata.default.ttl).toBe(60000); // 1 minute in milliseconds
      expect(metadata.default.limit).toBe(10);
    });
  });

  describe('Custom Rate Limiting Features', () => {
    it('should apply CustomRateLimit with metadata', () => {
      // Act
      const throttlerMetadata = Reflect.getMetadata(
        '__throttler_options__',
        controller.customRateLimitEndpoint,
      );
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        controller.customRateLimitEndpoint,
      );

      // Assert
      expect(throttlerMetadata).toBeDefined();
      expect(throttlerMetadata.default.ttl).toBe(120000); // 2 minutes in milliseconds
      expect(throttlerMetadata.default.limit).toBe(20);
      expect(customMetadata).toBeDefined();
      expect(customMetadata.message).toBe('Custom rate limit exceeded');
    });

    it('should apply UserBasedRateLimit with custom key function', () => {
      // Act
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        controller.userBasedEndpoint,
      );

      // Assert
      expect(customMetadata).toBeDefined();
      expect(customMetadata.customKey).toBeDefined();
      expect(typeof customMetadata.customKey).toBe('function');
    });

    it('should apply RateLimitWithMessage with custom message', () => {
      // Act
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        controller.messageEndpoint,
      );

      // Assert
      expect(customMetadata).toBeDefined();
      expect(customMetadata.message).toBe(
        'Too many requests. Please try again later.',
      );
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should generate different keys for user-based rate limiting', () => {
      // Arrange
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        controller.userBasedEndpoint,
      );
      const mockReqWithUser = { user: { id: 'user-123' }, ip: '192.168.1.1' };
      const mockReqWithoutUser = { ip: '192.168.1.1' };

      // Act
      const keyWithUser = customMetadata.customKey(mockReqWithUser);
      const keyWithoutUser = customMetadata.customKey(mockReqWithoutUser);

      // Assert
      expect(keyWithUser).toBe('user-123');
      expect(keyWithoutUser).toBe('192.168.1.1');
    });

    it('should handle edge cases in custom key generation', () => {
      // Arrange
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        controller.userBasedEndpoint,
      );
      const mockReqEmpty = {};

      // Act
      const key = customMetadata.customKey(mockReqEmpty);

      // Assert
      expect(key).toBeUndefined();
    });
  });

  describe('Decorator Composition', () => {
    it('should allow multiple decorators on same method', () => {
      // Arrange
      class MultiDecoratorController {
        @AuthRateLimit()
        @CustomRateLimit(
          { ttl: 300, limit: 3 },
          { message: 'Too many auth attempts' },
        )
        multiDecoratorEndpoint() {
          return 'multi';
        }
      }

      const multiController = new MultiDecoratorController();

      // Act
      const throttlerMetadata = Reflect.getMetadata(
        '__throttler_options__',
        multiController.multiDecoratorEndpoint,
      );
      const customMetadata = Reflect.getMetadata(
        RATE_LIMIT_METADATA,
        multiController.multiDecoratorEndpoint,
      );

      // Assert
      expect(throttlerMetadata).toBeDefined();
      expect(customMetadata).toBeDefined();
      expect(customMetadata.message).toBe('Too many auth attempts');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid decorator applications', () => {
      // Arrange
      const startTime = Date.now();

      // Act - Apply decorators rapidly
      for (let i = 0; i < 1000; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        class _TestClass {
          @AuthRateLimit()
          testMethod() {
            return 'test';
          }
        }
      }

      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle invalid configurations gracefully', () => {
      // Arrange & Act & Assert
      expect(() => RateLimit({ ttl: -1, limit: 10 })).not.toThrow();
      expect(() => RateLimit({ ttl: 60, limit: -1 })).not.toThrow();
      expect(() => RateLimit({ ttl: 0, limit: 0 })).not.toThrow();
    });

    it('should preserve method functionality', () => {
      // Act
      const result = controller.authEndpoint();

      // Assert
      expect(result).toBe('auth');
    });
  });

  describe('Integration with NestJS Throttler', () => {
    it('should work with NestJS throttler guard', async () => {
      // Arrange
      const guard = new ThrottlerGuard(
        {
          throttlers: [{ ttl: 60000, limit: 10 }],
          ignoreUserAgents: [],
        },
        reflector,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '192.168.1.1',
            method: 'GET',
            url: '/test',
            headers: {},
          }),
          getResponse: () => ({
            header: jest.fn(),
            set: jest.fn(),
          }),
        }),
        getHandler: () => controller.authEndpoint,
        getClass: () => TestController,
      } as ExecutionContext;

      // Act & Assert
      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing metadata gracefully', () => {
      // Arrange
      class EmptyController {
        regularMethod() {
          return 'regular';
        }
      }

      const emptyController = new EmptyController();

      // Act
      const metadata = Reflect.getMetadata(
        '__throttler_options__',
        emptyController.regularMethod,
      );

      // Assert
      expect(metadata).toBeUndefined();
    });

    it('should handle decorator application on non-methods', () => {
      // Arrange
      const decorator = AuthRateLimit();

      // Act & Assert
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        class _TestClass {
          @decorator
          property: string = 'test';
        }
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not cause memory leaks with repeated decorator applications', () => {
      // Arrange
      const initialMemory = process.memoryUsage();

      // Act - Create many classes with decorators
      for (let i = 0; i < 1000; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        class _TempClass {
          @AuthRateLimit()
          tempMethod() {
            return 'temp';
          }
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Assert - Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });
});

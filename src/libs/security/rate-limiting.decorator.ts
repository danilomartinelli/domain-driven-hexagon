import { SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Rate limiting configuration types
 */
export interface RateLimitConfig {
  name?: string;
  ttl: number; // Time window in seconds
  limit: number; // Max requests per time window
}

/**
 * Rate limiting decorator for different endpoint types
 */
export const RateLimit = (config: RateLimitConfig): MethodDecorator => {
  return Throttle({
    default: {
      ttl: config.ttl * 1000, // Convert to milliseconds
      limit: config.limit,
    },
  });
};

/**
 * Predefined rate limiting decorators for common use cases
 */

/**
 * Strict rate limiting for authentication endpoints
 * 5 requests per minute to prevent brute force attacks
 */
export const AuthRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'auth',
    ttl: 60, // 1 minute
    limit: 5,
  });

/**
 * Standard rate limiting for API endpoints
 * 100 requests per minute for general API usage
 */
export const ApiRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'api',
    ttl: 60, // 1 minute
    limit: 100,
  });

/**
 * Restrictive rate limiting for file upload endpoints
 * 10 requests per 5 minutes to prevent abuse
 */
export const UploadRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'upload',
    ttl: 300, // 5 minutes
    limit: 10,
  });

/**
 * Moderate rate limiting for search endpoints
 * 50 requests per minute to prevent scraping
 */
export const SearchRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'search',
    ttl: 60, // 1 minute
    limit: 50,
  });

/**
 * Very strict rate limiting for password reset endpoints
 * 3 requests per 15 minutes to prevent abuse
 */
export const PasswordResetRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'password-reset',
    ttl: 900, // 15 minutes
    limit: 3,
  });

/**
 * Email sending rate limit
 * 5 emails per hour to prevent spam
 */
export const EmailRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'email',
    ttl: 3600, // 1 hour
    limit: 5,
  });

/**
 * Admin operations rate limit
 * 20 requests per 5 minutes for admin operations
 */
export const AdminRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'admin',
    ttl: 300, // 5 minutes
    limit: 20,
  });

/**
 * Public API rate limit
 * 1000 requests per hour for public API access
 */
export const PublicApiRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'public',
    ttl: 3600, // 1 hour
    limit: 1000,
  });

/**
 * User profile rate limit
 * 30 requests per minute for user profile operations
 */
export const UserProfileRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'user-profile',
    ttl: 60, // 1 minute
    limit: 30,
  });

/**
 * Database intensive operations rate limit
 * 10 requests per minute for heavy operations
 */
export const HeavyOperationRateLimit = (): MethodDecorator =>
  RateLimit({
    name: 'heavy-operation',
    ttl: 60, // 1 minute
    limit: 10,
  });

/**
 * Custom metadata for additional rate limiting features
 */
export const RATE_LIMIT_METADATA = 'rate_limit_metadata';

export interface RateLimitMetadata {
  skipIf?: (req: any) => boolean; // Function to skip rate limiting
  onLimit?: (req: any) => void; // Function to call when limit is hit
  message?: string; // Custom error message
  customKey?: (req: any) => string; // Custom key generation
}

/**
 * Enhanced rate limiting with custom options
 */
export const CustomRateLimit = (
  config: RateLimitConfig,
  metadata?: RateLimitMetadata,
): MethodDecorator => {
  return (
    target: unknown,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void => {
    // Apply the basic rate limiting only if we have the required parameters
    if (propertyKey !== undefined && descriptor !== undefined) {
      RateLimit(config)(target, propertyKey, descriptor);

      // Add custom metadata if provided
      if (metadata) {
        SetMetadata(RATE_LIMIT_METADATA, metadata)(
          target,
          propertyKey,
          descriptor,
        );
      }
    }
  };
};

/**
 * Skip rate limiting for specific conditions
 */
export const SkipRateLimit = (
  condition: (req: unknown) => boolean,
): MethodDecorator => {
  return CustomRateLimit(
    { ttl: 60, limit: 1000 }, // High default limit
    { skipIf: condition },
  );
};

/**
 * Rate limit per user instead of per IP
 */
export const UserBasedRateLimit = (
  config: RateLimitConfig,
): MethodDecorator => {
  return CustomRateLimit(config, {
    customKey: (req: any) => req.user?.id || req.ip,
  });
};

/**
 * Rate limit with custom error message
 */
export const RateLimitWithMessage = (
  config: RateLimitConfig,
  message: string,
): MethodDecorator => {
  return CustomRateLimit(config, { message });
};

/**
 * Example usage patterns:
 *
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @AuthRateLimit()
 *   async login() { ... }
 *
 *   @Post('register')
 *   @RateLimitWithMessage(
 *     { ttl: 60, limit: 3 },
 *     'Too many registration attempts. Please try again in a minute.'
 *   )
 *   async register() { ... }
 *
 *   @Post('password-reset')
 *   @PasswordResetRateLimit()
 *   async resetPassword() { ... }
 * }
 *
 * @Controller('api')
 * export class ApiController {
 *   @Get('data')
 *   @ApiRateLimit()
 *   async getData() { ... }
 *
 *   @Get('search')
 *   @SearchRateLimit()
 *   async search() { ... }
 *
 *   @Post('upload')
 *   @UploadRateLimit()
 *   async upload() { ... }
 * }
 */

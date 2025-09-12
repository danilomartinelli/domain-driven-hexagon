/**
 * Security Module Exports
 * Comprehensive security features for NestJS applications
 */

// Core security module
export { SecurityModule } from './security.module';

// Services
export { SecurityService } from './security.service';
export { EnvValidatorService } from './env-validator.service';
export { InputSanitizerService } from './input-sanitizer.service';
export { SecurityLogger } from './security-logger.service';

// Middleware and interceptors
export { SecurityMiddleware } from './security.middleware';
export { SecurityInterceptor } from './security.interceptor';

// Rate limiting decorators
export {
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
  SkipRateLimit,
  UserBasedRateLimit,
  RateLimitWithMessage,
  RATE_LIMIT_METADATA,
  RateLimitConfig,
  RateLimitMetadata,
} from './rate-limiting.decorator';

// Security event types
export {
  SecurityEvent,
  SecurityEventType,
} from './security-logger.service';

/**
 * Example usage:
 * 
 * // Import the security module in your app.module.ts
 * import { SecurityModule } from '@libs/security';
 * 
 * @Module({
 *   imports: [SecurityModule, ...],
 * })
 * export class AppModule {}
 * 
 * // Use rate limiting decorators in your controllers
 * import { AuthRateLimit, ApiRateLimit } from '@libs/security';
 * 
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @AuthRateLimit()
 *   async login() { ... }
 * }
 * 
 * // Use input sanitization in your services
 * import { InputSanitizerService } from '@libs/security';
 * 
 * @Injectable()
 * export class UserService {
 *   constructor(private sanitizer: InputSanitizerService) {}
 * 
 *   async updateProfile(data: any) {
 *     const cleanData = this.sanitizer.sanitizeObject(data);
 *     // ... process clean data
 *   }
 * }
 */
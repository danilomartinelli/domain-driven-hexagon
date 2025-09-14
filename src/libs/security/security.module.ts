import { Module, Global } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SecurityService } from './security.service';
import { SecurityInterceptor } from './security.interceptor';
import { SecurityMiddleware } from './security.middleware';
import { EnvValidatorService } from './env-validator.service';
import { InputSanitizerService } from './input-sanitizer.service';
import { SecurityLogger } from './security-logger.service';

/**
 * Global security module providing comprehensive security features
 * - Request/response security headers
 * - Rate limiting with IP-based throttling
 * - Input sanitization and XSS prevention
 * - Security logging and monitoring
 * - Environment validation
 */
@Global()
@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRootAsync({
      useFactory: (envValidator: EnvValidatorService) => {
        return {
          throttlers: [
            {
              name: 'default',
              ttl: envValidator.get('RATE_LIMIT_TTL') * 1000, // Convert to milliseconds
              limit: envValidator.get('RATE_LIMIT_MAX'),
            },
          ],
        };
      },
      inject: [EnvValidatorService],
    }),
  ],
  providers: [
    EnvValidatorService,
    SecurityService,
    InputSanitizerService,
    SecurityLogger,
    SecurityMiddleware,

    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global interceptors for security
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityInterceptor,
    },
  ],
  exports: [
    SecurityService,
    InputSanitizerService,
    SecurityLogger,
    EnvValidatorService,
    SecurityMiddleware,
  ],
})
export class SecurityModule {}

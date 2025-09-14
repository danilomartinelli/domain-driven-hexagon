import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { createHash } from 'crypto';

/**
 * Environment variable security schema
 * Validates and sanitizes environment variables on application startup
 */
const SecurityEnvSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),

  // Database - Required and validated
  DB_HOST: z.string().min(1).max(253), // Valid hostname length
  DB_PORT: z.coerce.number().min(1).max(65535),
  DB_USERNAME: z.string().min(1).max(63), // PostgreSQL username limit
  DB_PASSWORD: z.string().min(8).max(128), // Reasonable password length
  DB_NAME: z.string().min(1).max(63), // PostgreSQL database name limit

  // Database SSL
  DB_SSL: z.coerce.boolean().default(false),
  DB_SSL_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),

  // Security
  JWT_SECRET: z.string().min(32).optional(), // If using JWT
  ENCRYPTION_KEY: z.string().min(32).optional(), // If using encryption
  SESSION_SECRET: z.string().min(32).optional(), // If using sessions

  // Rate limiting
  RATE_LIMIT_TTL: z.coerce.number().min(1).default(60), // seconds
  RATE_LIMIT_MAX: z.coerce.number().min(1).default(100), // requests per TTL

  // Security headers
  CSP_ENABLED: z.coerce.boolean().default(true),
  HSTS_MAX_AGE: z.coerce.number().min(0).default(31536000), // 1 year

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_SECURITY_EVENTS: z.coerce.boolean().default(true),
});

type SecurityEnv = z.infer<typeof SecurityEnvSchema>;

/**
 * Secure environment variable management service
 * Validates environment variables and provides secure access patterns
 */
@Injectable()
export class EnvValidatorService implements OnModuleInit {
  private readonly logger = new Logger(EnvValidatorService.name);
  private validatedEnv: SecurityEnv;
  private sensitiveKeys = new Set([
    'DB_PASSWORD',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'SESSION_SECRET',
  ]);

  async onModuleInit(): Promise<void> {
    await this.validateEnvironment();
    this.performSecurityChecks();
    this.logSecurityStatus();
  }

  /**
   * Validate and parse environment variables
   */
  private async validateEnvironment(): Promise<void> {
    try {
      this.validatedEnv = SecurityEnvSchema.parse(process.env);
      this.logger.log('Environment variables validated successfully');
    } catch (error) {
      this.logger.error('Environment validation failed', error);

      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        this.logger.error('Environment validation issues:', issues);
      }

      throw new Error(
        'Invalid environment configuration. Check logs for details.',
      );
    }
  }

  /**
   * Perform additional security checks on environment
   */
  private performSecurityChecks(): void {
    const warnings: string[] = [];

    // Check for production security requirements
    if (this.validatedEnv.NODE_ENV === 'production') {
      if (!this.validatedEnv.DB_SSL) {
        warnings.push('Database SSL is disabled in production');
      }

      if (!this.validatedEnv.JWT_SECRET) {
        warnings.push('JWT_SECRET is not set in production');
      }

      if (this.validatedEnv.CORS_ORIGIN === 'http://localhost:3000') {
        warnings.push('CORS origin is set to localhost in production');
      }

      if (this.validatedEnv.LOG_LEVEL === 'debug') {
        warnings.push('Debug logging is enabled in production');
      }
    }

    // Check for weak passwords/secrets
    if (
      this.validatedEnv.DB_PASSWORD &&
      this.isWeakPassword(this.validatedEnv.DB_PASSWORD)
    ) {
      warnings.push('Database password appears to be weak');
    }

    // Check for default/example values
    const defaultPatterns = [
      /^(password|secret|key|token)$/i,
      /^(test|example|demo|default)$/i,
      /^(admin|root|user)$/i,
    ];

    for (const [key, value] of Object.entries(this.validatedEnv)) {
      if (
        typeof value === 'string' &&
        defaultPatterns.some((pattern) => pattern.test(value))
      ) {
        warnings.push(`${key} appears to use a default/example value`);
      }
    }

    // Log warnings
    warnings.forEach((warning) => {
      this.logger.warn(`Security Warning: ${warning}`);
    });
  }

  /**
   * Check if password is weak
   */
  private isWeakPassword(password: string): boolean {
    // Basic weak password detection
    const weakPatterns = [
      /^password/i,
      /^123/,
      /^admin/i,
      /^qwerty/i,
      /^letmein/i,
    ];

    return (
      password.length < 12 || // Too short
      !/[A-Z]/.test(password) || // No uppercase
      !/[a-z]/.test(password) || // No lowercase
      !/[0-9]/.test(password) || // No numbers
      !/[^A-Za-z0-9]/.test(password) || // No special chars
      weakPatterns.some((pattern) => pattern.test(password)) // Common weak patterns
    );
  }

  /**
   * Log security status (without exposing sensitive values)
   */
  private logSecurityStatus(): void {
    const securityStatus = {
      environment: this.validatedEnv.NODE_ENV,
      sslEnabled: this.validatedEnv.DB_SSL,
      cspEnabled: this.validatedEnv.CSP_ENABLED,
      corsOrigin: this.validatedEnv.CORS_ORIGIN,
      rateLimitEnabled: true,
      logLevel: this.validatedEnv.LOG_LEVEL,
      secretsConfigured: {
        jwtSecret: !!this.validatedEnv.JWT_SECRET,
        encryptionKey: !!this.validatedEnv.ENCRYPTION_KEY,
        sessionSecret: !!this.validatedEnv.SESSION_SECRET,
      },
    };

    this.logger.log('Security configuration status:', securityStatus);
  }

  /**
   * Safely get environment variable
   */
  get<T extends keyof SecurityEnv>(key: T): SecurityEnv[T] {
    if (!this.validatedEnv) {
      throw new Error('Environment not initialized. Call onModuleInit first.');
    }

    return this.validatedEnv[key];
  }

  /**
   * Check if key is sensitive (for logging/debugging)
   */
  isSensitive(key: string): boolean {
    return this.sensitiveKeys.has(key);
  }

  /**
   * Get sanitized environment for logging
   */
  getSanitizedEnv(): Record<string, string | number | boolean | undefined> {
    if (!this.validatedEnv) {
      return {};
    }

    const sanitized: Record<string, string | number | boolean | undefined> = {};

    for (const [key, value] of Object.entries(this.validatedEnv)) {
      if (this.isSensitive(key)) {
        sanitized[key] = this.maskSensitiveValue(String(value));
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Mask sensitive values for logging
   */
  private maskSensitiveValue(value: string): string {
    if (value.length <= 4) {
      return '***';
    }

    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }

  /**
   * Generate secure hash of environment for integrity checking
   */
  getEnvironmentHash(): string {
    const envString = JSON.stringify(
      this.validatedEnv,
      Object.keys(this.validatedEnv).sort(),
    );
    return createHash('sha256')
      .update(envString)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Validate runtime environment changes
   */
  validateRuntimeSecurity(): boolean {
    try {
      // Check if sensitive environment variables have been modified
      // const currentHash = this.getEnvironmentHash();

      // In a real implementation, you'd store the initial hash and compare
      // For now, we'll just validate that required variables still exist
      const requiredVars = [
        'DB_HOST',
        'DB_PORT',
        'DB_USERNAME',
        'DB_PASSWORD',
        'DB_NAME',
      ];

      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          this.logger.error(
            `Critical environment variable ${varName} is missing`,
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Runtime security validation failed', error);
      return false;
    }
  }
}

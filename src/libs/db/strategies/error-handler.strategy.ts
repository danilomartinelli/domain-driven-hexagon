import {
  UniqueIntegrityConstraintViolationError,
  NotFoundError,
  DataIntegrityError,
  CheckIntegrityConstraintViolationError,
  ForeignKeyIntegrityConstraintViolationError,
} from 'slonik';
import { ConflictException } from '@libs/exceptions';
import { LoggerPort } from '../../ports/logger.port';

/**
 * Error classification for different types of database errors
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  INTEGRITY = 'INTEGRITY',
  AUTHENTICATION = 'AUTHENTICATION', 
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  CONNECTIVITY = 'CONNECTIVITY',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error information for logging and monitoring
 */
export interface ErrorContext {
  operation: string;
  table: string;
  requestId: string;
  timestamp: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  securityRelevant: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Strategy interface for handling repository errors
 */
export interface ErrorHandlerStrategy {
  handleError(error: Error, operation: string, table: string, context?: Record<string, unknown>): void;
  isRetryable(error: Error): boolean;
  categorizeError(error: Error): ErrorCategory;
  getSeverity(error: Error): ErrorSeverity;
}

/**
 * Production-ready error handler with security-conscious logging
 */
export class SecureErrorHandlerStrategy implements ErrorHandlerStrategy {
  private static readonly SUSPICIOUS_PATTERNS = [
    'sql injection',
    'union select',
    'information_schema',
    'pg_tables',
    'pg_user', 
    'version()',
    'current_user',
    'current_database',
    'drop table',
    'delete from',
    'truncate',
    'alter table',
    'create table',
  ];

  private static readonly SENSITIVE_FIELD_PATTERNS = [
    'password',
    'token',
    'secret',
    'key',
    'credential',
    'auth',
    'session',
    'jwt',
  ];

  private readonly errorCounts = new Map<string, { count: number; lastSeen: number }>();
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    private readonly logger: LoggerPort,
    private readonly getRequestId: () => string,
  ) {}

  handleError(error: Error, operation: string, table: string, context?: Record<string, unknown>): void {
    const requestId = this.getRequestId();
    const errorContext = this.buildErrorContext(error, operation, table, requestId, context);

    // Track error patterns for security monitoring
    this.trackErrorPattern(errorContext);

    // Handle specific error types
    if (error instanceof UniqueIntegrityConstraintViolationError) {
      this.handleUniqueConstraintViolation(error, errorContext);
    } else if (error instanceof NotFoundError) {
      this.handleNotFoundError(error, errorContext);
    } else if (error instanceof DataIntegrityError) {
      this.handleDataIntegrityError(error, errorContext);
    } else if (error instanceof CheckIntegrityConstraintViolationError) {
      this.handleCheckConstraintViolation(error, errorContext);
    } else if (error instanceof ForeignKeyIntegrityConstraintViolationError) {
      this.handleForeignKeyViolation(error, errorContext);
    } else {
      this.handleGenericError(error, errorContext);
    }

    // Log security events if needed
    if (errorContext.securityRelevant) {
      this.logSecurityEvent(error, errorContext);
    }
  }

  isRetryable(error: Error): boolean {
    // Connection-related errors are typically retryable
    if ('code' in error) {
      const errorCode = (error as any).code;
      const retryableCodes = [
        '53300', // too_many_connections
        '57P01', // admin_shutdown
        '57P02', // crash_shutdown
        '57P03', // cannot_connect_now
        '40001', // serialization_failure
        '40P01', // deadlock_detected
      ];
      
      if (retryableCodes.includes(errorCode)) {
        return true;
      }
    }

    // Check error message patterns
    const errorMessage = error.message.toLowerCase();
    const retryablePatterns = [
      'connection terminated',
      'connection lost',
      'server closed the connection',
      'timeout',
      'network error',
      'connection refused',
    ];

    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  categorizeError(error: Error): ErrorCategory {
    if (error instanceof UniqueIntegrityConstraintViolationError ||
        error instanceof CheckIntegrityConstraintViolationError ||
        error instanceof ForeignKeyIntegrityConstraintViolationError ||
        error instanceof DataIntegrityError) {
      return ErrorCategory.INTEGRITY;
    }

    if (error instanceof NotFoundError) {
      return ErrorCategory.VALIDATION;
    }

    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
      return ErrorCategory.AUTHORIZATION;
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('login')) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('slow')) {
      return ErrorCategory.PERFORMANCE;
    }

    if (errorMessage.includes('connection')) {
      return ErrorCategory.CONNECTIVITY;
    }

    if (this.isSuspiciousError(error)) {
      return ErrorCategory.SECURITY;
    }

    return ErrorCategory.UNKNOWN;
  }

  getSeverity(error: Error): ErrorSeverity {
    if (this.isSuspiciousError(error)) {
      return ErrorSeverity.CRITICAL;
    }

    if (error instanceof DataIntegrityError) {
      return ErrorSeverity.HIGH;
    }

    if (error instanceof UniqueIntegrityConstraintViolationError) {
      return ErrorSeverity.MEDIUM;
    }

    if (error instanceof NotFoundError) {
      return ErrorSeverity.LOW;
    }

    // Default to medium severity for unknown errors
    return ErrorSeverity.MEDIUM;
  }

  private buildErrorContext(
    error: Error,
    operation: string,
    table: string,
    requestId: string,
    context?: Record<string, unknown>,
  ): ErrorContext {
    return {
      operation,
      table,
      requestId,
      timestamp: new Date().toISOString(),
      category: this.categorizeError(error),
      severity: this.getSeverity(error),
      retryable: this.isRetryable(error),
      securityRelevant: this.isSuspiciousError(error),
      metadata: this.sanitizeContext(context),
    };
  }

  private handleUniqueConstraintViolation(
    error: UniqueIntegrityConstraintViolationError,
    context: ErrorContext,
  ): void {
    this.logger.warn(
      `[${context.requestId}] Unique constraint violation in ${context.operation}`,
      {
        ...context,
        errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
        errorMessage: this.isProduction ? undefined : this.sanitizeErrorMessage(error.message),
      },
    );
  }

  private handleNotFoundError(error: NotFoundError, context: ErrorContext): void {
    this.logger.debug(
      `[${context.requestId}] Entity not found in ${context.operation}`,
      {
        ...context,
        errorCode: 'ENTITY_NOT_FOUND',
      },
    );
  }

  private handleDataIntegrityError(error: DataIntegrityError, context: ErrorContext): void {
    this.logger.error(
      `[${context.requestId}] Data integrity error in ${context.operation}`,
      {
        ...context,
        errorCode: 'DATA_INTEGRITY_ERROR',
        errorMessage: this.isProduction ? undefined : this.sanitizeErrorMessage(error.message),
      },
    );
  }

  private handleCheckConstraintViolation(
    error: CheckIntegrityConstraintViolationError,
    context: ErrorContext,
  ): void {
    this.logger.warn(
      `[${context.requestId}] Check constraint violation in ${context.operation}`,
      {
        ...context,
        errorCode: 'CHECK_CONSTRAINT_VIOLATION',
        errorMessage: this.isProduction ? undefined : this.sanitizeErrorMessage(error.message),
      },
    );
  }

  private handleForeignKeyViolation(
    error: ForeignKeyIntegrityConstraintViolationError,
    context: ErrorContext,
  ): void {
    this.logger.warn(
      `[${context.requestId}] Foreign key constraint violation in ${context.operation}`,
      {
        ...context,
        errorCode: 'FOREIGN_KEY_VIOLATION',
        errorMessage: this.isProduction ? undefined : this.sanitizeErrorMessage(error.message),
      },
    );
  }

  private handleGenericError(error: Error, context: ErrorContext): void {
    const logData = {
      ...context,
      errorCode: 'REPOSITORY_ERROR',
      errorType: error.constructor.name,
    };

    if (!this.isProduction) {
      logData['errorMessage'] = this.sanitizeErrorMessage(error.message);
      logData['stack'] = this.sanitizeStackTrace(error.stack);
    } else {
      // Log full error details to secure location
      this.logProductionError(error, context);
    }

    this.logger.error(
      `[${context.requestId}] Repository error in ${context.operation}`,
      logData,
    );
  }

  private isSuspiciousError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return SecureErrorHandlerStrategy.SUSPICIOUS_PATTERNS.some(pattern =>
      errorMessage.includes(pattern),
    );
  }

  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Unknown error';

    return message
      // Remove connection strings
      .replace(/postgresql:\/\/[^@]+@[^/]+\/\w+/gi, 'postgresql://[REDACTED]')
      // Remove table/column names that might be sensitive
      .replace(/relation "([^"]+)"/gi, 'relation "[REDACTED]"')
      .replace(/column "([^"]+)"/gi, 'column "[REDACTED]"')
      // Remove potential passwords or tokens
      .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]')
      .replace(/token[=:]\s*[^\s]+/gi, 'token=[REDACTED]')
      // Remove SQL query details
      .replace(/query:\s*.+$/gim, 'query: [REDACTED]')
      // Limit length to prevent log injection
      .substring(0, 500);
  }

  private sanitizeStackTrace(stack?: string): string {
    if (!stack) return '';

    return stack
      // Remove file system paths
      .replace(/\/[^\s:]+\//g, '/[PATH]/')
      // Remove user home directory references
      .replace(/\/Users\/[^\/\s:]+/g, '/Users/[USER]')
      .replace(/\/home\/[^\/\s:]+/g, '/home/[USER]')
      // Limit stack trace length
      .split('\n')
      .slice(0, 10)
      .join('\n');
  }

  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };

    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();

      if (SecureErrorHandlerStrategy.SENSITIVE_FIELD_PATTERNS.some(pattern =>
        lowerKey.includes(pattern)
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[TRUNCATED]';
      }
    }

    return sanitized;
  }

  private trackErrorPattern(context: ErrorContext): void {
    const errorKey = `${context.operation}-${context.table}-${context.category}`;
    const now = Date.now();
    const existing = this.errorCounts.get(errorKey);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
    } else {
      this.errorCounts.set(errorKey, { count: 1, lastSeen: now });
    }

    // Check for excessive errors (simple rate limiting)
    if (existing && existing.count > 10 && (now - existing.lastSeen) < 60000) {
      this.logger.warn(
        `[${context.requestId}] High error rate detected`,
        {
          errorKey,
          count: existing.count,
          timeWindow: '60s',
          severity: ErrorSeverity.HIGH,
        },
      );
    }
  }

  private logSecurityEvent(error: Error, context: ErrorContext): void {
    this.logger.warn(
      `[SECURITY] Suspicious database error pattern detected`,
      {
        operation: context.operation,
        table: context.table,
        errorType: error.constructor.name,
        requestId: context.requestId,
        timestamp: context.timestamp,
        severity: ErrorSeverity.CRITICAL,
      },
    );
  }

  private logProductionError(error: Error, context: ErrorContext): void {
    // In production, log full error details to secure location for debugging
    const secureErrorDetails = {
      requestId: context.requestId,
      operation: context.operation,
      table: context.table,
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
      timestamp: context.timestamp,
      securityLevel: 'INTERNAL_DEBUG',
    };

    // This could be sent to a secure logging service in production
    this.logger.debug(
      `[SECURE_DEBUG] Full error details for request ${context.requestId}`,
      secureErrorDetails,
    );
  }
}
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SecurityLogger } from './security-logger.service';
import { InputSanitizerService } from './input-sanitizer.service';

/**
 * Security interceptor for request/response processing
 * Handles input sanitization and security event logging
 */
@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityInterceptor.name);

  constructor(
    private readonly securityLogger: SecurityLogger,
    private readonly inputSanitizer: InputSanitizerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Sanitize input data
    if (request.body && typeof request.body === 'object') {
      try {
        request.body = this.inputSanitizer.sanitizeObject(request.body);
      } catch (error) {
        this.logger.warn('Input sanitization failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: request.url,
          method: request.method,
        });
      }
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      try {
        request.query = this.inputSanitizer.sanitizeObject(request.query);
      } catch (error) {
        this.logger.warn('Query parameter sanitization failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: request.url,
          method: request.method,
        });
      }
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Log successful requests with security context
        this.logSecureRequest(request, response, duration);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log security-relevant errors
        this.logSecurityError(request, response, error, duration);

        // Don't expose sensitive error details in production
        const sanitizedError = this.sanitizeError(error);

        return throwError(() => sanitizedError);
      }),
    );
  }

  /**
   * Log successful requests with security context
   */
  private logSecureRequest(
    request: Request,
    response: Response,
    duration: number,
  ): void {
    // Log requests to sensitive endpoints
    const sensitiveEndpoints = ['/auth', '/admin', '/user', '/upload'];
    const isSensitive = sensitiveEndpoints.some((endpoint) =>
      request.url?.startsWith(endpoint),
    );

    if (isSensitive) {
      this.securityLogger.logSecurityEvent({
        type: 'SENSITIVE_ENDPOINT_ACCESS',
        severity: 'LOW',
        details: {
          ip: request.ip,
          url: request.url,
          method: request.method,
          statusCode: response.statusCode,
          duration,
          userAgent: request.get('User-Agent'),
        },
        timestamp: new Date(),
      });
    }

    // Log unusually fast responses (potential cached bypass attempts)
    if (duration < 10 && request.method !== 'GET') {
      this.securityLogger.logSecurityEvent({
        type: 'UNUSUALLY_FAST_RESPONSE',
        severity: 'LOW',
        details: {
          ip: request.ip,
          url: request.url,
          method: request.method,
          duration,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Log security-relevant errors
   */
  private logSecurityError(
    request: Request,
    response: Response,
    error: any,
    duration: number,
  ): void {
    const errorType = error.constructor.name;
    const isSecurityError = this.isSecurityRelatedError(error);

    if (isSecurityError) {
      this.securityLogger.logSecurityEvent({
        type: 'SECURITY_ERROR',
        severity: 'HIGH',
        details: {
          ip: request.ip,
          url: request.url,
          method: request.method,
          errorType,
          errorMessage: error.message,
          statusCode: error.status || 500,
          duration,
          userAgent: request.get('User-Agent'),
        },
        timestamp: new Date(),
      });
    }

    // Log validation errors that might indicate attack attempts
    if (error.status === 400 && error.message?.includes('validation')) {
      this.securityLogger.logSecurityEvent({
        type: 'VALIDATION_ERROR',
        severity: 'MEDIUM',
        details: {
          ip: request.ip,
          url: request.url,
          method: request.method,
          errorMessage: error.message,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check if error is security-related
   */
  private isSecurityRelatedError(error: any): boolean {
    const securityErrorTypes = [
      'UnauthorizedException',
      'ForbiddenException',
      'BadRequestException',
      'TooManyRequestsException',
      'ConflictException',
    ];

    const securityKeywords = [
      'injection',
      'xss',
      'csrf',
      'authentication',
      'authorization',
      'permission',
      'access denied',
      'invalid token',
      'malicious',
    ];

    const errorType = error.constructor.name;
    const errorMessage = (error.message || '').toLowerCase();

    return (
      securityErrorTypes.includes(errorType) ||
      securityKeywords.some((keyword) => errorMessage.includes(keyword))
    );
  }

  /**
   * Sanitize error responses to prevent information disclosure
   */
  private sanitizeError(error: any): any {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      // In development, return full error details
      return error;
    }

    // In production, sanitize error responses
    const sanitizedError = {
      message: this.getSafeErrorMessage(error),
      statusCode: error.status || 500,
      timestamp: new Date().toISOString(),
    };

    // Add correlation ID if available
    if (error.correlationId) {
      sanitizedError['correlationId'] = error.correlationId;
    }

    return sanitizedError;
  }

  /**
   * Get safe error message for production
   */
  private getSafeErrorMessage(error: any): string {
    // Map of safe error messages for production
    const safeMessages = {
      400: 'Invalid request data',
      401: 'Authentication required',
      403: 'Access forbidden',
      404: 'Resource not found',
      429: 'Too many requests',
      500: 'Internal server error',
    };

    const statusCode = error.status || 500;

    // For validation errors, provide generic message
    if (statusCode === 400 && error.message?.includes('validation')) {
      return 'Validation failed';
    }

    return safeMessages[statusCode] || 'An error occurred';
  }
}

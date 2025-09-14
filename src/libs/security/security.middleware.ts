import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecurityService } from './security.service';
import { SecurityLogger } from './security-logger.service';

/**
 * Security middleware that applies security configurations and logging
 * Applied globally to all routes for consistent security posture
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(
    private readonly securityService: SecurityService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    try {
      // Validate request security
      const validation = this.securityService.validateRequestSecurity(req);

      if (!validation.valid) {
        // Log security issues but don't block request (monitoring only)
        this.securityLogger.logSecurityEvent({
          type: 'REQUEST_VALIDATION_FAILED',
          severity: 'MEDIUM',
          details: {
            ip: req.ip,
            url: req.url,
            method: req.method,
            userAgent: req.get('User-Agent'),
            issues: validation.issues,
          },
          timestamp: new Date(),
        });
      }

      // Apply security middleware
      this.securityService.applySecurityMiddleware(req, res, next);

      // Track response completion for security logging
      res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Log slow requests that might indicate attacks
        if (duration > 5000) {
          // 5 seconds
          this.securityLogger.logSecurityEvent({
            type: 'SLOW_REQUEST',
            severity: 'LOW',
            details: {
              ip: req.ip,
              url: req.url,
              method: req.method,
              duration,
              statusCode: res.statusCode,
            },
            timestamp: new Date(),
          });
        }

        // Log failed authentication attempts
        if (res.statusCode === 401 || res.statusCode === 403) {
          this.securityLogger.logSecurityEvent({
            type: 'AUTH_FAILURE',
            severity: 'MEDIUM',
            details: {
              ip: req.ip,
              url: req.url,
              method: req.method,
              statusCode: res.statusCode,
              userAgent: req.get('User-Agent'),
            },
            timestamp: new Date(),
          });
        }

        // Log server errors that might indicate attacks
        if (res.statusCode >= 500) {
          this.securityLogger.logSecurityEvent({
            type: 'SERVER_ERROR',
            severity: 'HIGH',
            details: {
              ip: req.ip,
              url: req.url,
              method: req.method,
              statusCode: res.statusCode,
            },
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {
      this.logger.error('Security middleware error', error);

      // Don't block request on security middleware errors
      next();
    }
  }
}

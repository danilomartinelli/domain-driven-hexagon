import { Injectable, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { EnvValidatorService } from './env-validator.service';

/**
 * Core security service providing OWASP-compliant security configurations
 * Implements security headers, CORS, and content security policies
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly envValidator: EnvValidatorService) {}

  /**
   * Get Helmet configuration with OWASP recommendations
   */
  getHelmetConfig(): ReturnType<typeof helmet> {
    const isProduction = this.envValidator.get('NODE_ENV') === 'production';
    const cspEnabled = this.envValidator.get('CSP_ENABLED');
    const hstsMaxAge = this.envValidator.get('HSTS_MAX_AGE');

    return helmet({
      // Content Security Policy - prevents XSS attacks
      contentSecurityPolicy: cspEnabled
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'", // For inline styles (consider removing in production)
                'https://fonts.googleapis.com',
                'https://cdn.jsdelivr.net',
              ],
              scriptSrc: [
                "'self'",
                // Only allow specific trusted domains for scripts
                ...(isProduction ? [] : ["'unsafe-eval'"]), // Only allow eval in development
              ],
              imgSrc: [
                "'self'",
                'data:',
                'https:', // Allow HTTPS images
              ],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              connectSrc: [
                "'self'",
                // Add your API domains here
              ],
              frameSrc: ["'none'"], // Prevent embedding in iframes
              objectSrc: ["'none'"], // Prevent plugins
              baseUri: ["'self'"], // Restrict base tag
              formAction: ["'self'"], // Restrict form submissions
              ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
            },
          }
        : false,

      // HTTP Strict Transport Security - enforces HTTPS
      hsts: isProduction
        ? {
            maxAge: hstsMaxAge,
            includeSubDomains: true,
            preload: true,
          }
        : false,

      // X-Frame-Options - prevents clickjacking
      frameguard: {
        action: 'deny',
      },

      // X-Content-Type-Options - prevents MIME type sniffing
      noSniff: true,

      // X-XSS-Protection - enables XSS filtering
      xssFilter: true,

      // Referrer Policy - controls referrer information
      referrerPolicy: {
        policy: ['no-referrer', 'strict-origin-when-cross-origin'],
      },

      // Remove X-Powered-By header to hide technology stack
      hidePoweredBy: true,

      // Note: permissionsPolicy is not available in current helmet version
      // This would be configured separately if needed

      // Cross-Origin-Embedder-Policy
      crossOriginEmbedderPolicy: isProduction,

      // Cross-Origin-Opener-Policy
      crossOriginOpenerPolicy: {
        policy: 'same-origin',
      },

      // Cross-Origin-Resource-Policy
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },
    });
  }

  /**
   * Get CORS configuration
   */
  getCorsConfig(): object {
    const corsOrigin = this.envValidator.get('CORS_ORIGIN');
    const corsCredentials = this.envValidator.get('CORS_CREDENTIALS');
    const isProduction = this.envValidator.get('NODE_ENV') === 'production';

    return {
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          return callback(null, true);
        }

        // In production, be strict about origins
        if (isProduction) {
          const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            this.logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'), false);
          }
        } else {
          // In development, allow more flexibility but log warnings
          if (origin !== corsOrigin && !origin.includes('localhost')) {
            this.logger.warn(
              `CORS allowing non-configured origin in development: ${origin}`,
            );
          }
          callback(null, true);
        }
      },
      credentials: corsCredentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'X-Correlation-ID',
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Correlation-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      maxAge: 86400, // 24 hours
    };
  }

  /**
   * Apply security middleware to Express app
   */
  applySecurityMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // Add custom security headers
    this.addCustomSecurityHeaders(res);

    // Log security events
    this.logSecurityEvent(req);

    next();
  }

  /**
   * Add custom security headers not covered by Helmet
   */
  private addCustomSecurityHeaders(res: Response): void {
    const isProduction = this.envValidator.get('NODE_ENV') === 'production';

    // Custom headers for API security
    res.setHeader('X-API-Version', '1.0');
    res.setHeader('X-Response-Time', Date.now());

    // Cache control for sensitive endpoints
    if (res.req.url?.includes('/auth/') || res.req.url?.includes('/user/')) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // Additional security headers
    if (isProduction) {
      res.setHeader('Expect-CT', 'max-age=86400, enforce');
      res.setHeader('X-Download-Options', 'noopen');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }
  }

  /**
   * Log security-relevant events
   */
  private logSecurityEvent(req: Request): void {
    const securityHeaders = {
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      xForwardedFor: req.get('X-Forwarded-For'),
      xRealIp: req.get('X-Real-IP'),
      authorization: req.get('Authorization') ? '[PRESENT]' : '[ABSENT]',
    };

    // Log potential security issues
    if (
      req.get('X-Forwarded-Proto') === 'http' &&
      this.envValidator.get('NODE_ENV') === 'production'
    ) {
      this.logger.warn('HTTP request in production environment', {
        ip: req.ip,
        url: req.url,
        method: req.method,
      });
    }

    // Log suspicious User-Agent strings
    const userAgent = req.get('User-Agent') || '';
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /burpsuite/i,
      /dirbuster/i,
      /gobuster/i,
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
      this.logger.warn('Suspicious User-Agent detected', {
        userAgent,
        ip: req.ip,
        url: req.url,
        severity: 'HIGH',
      });
    }

    // Debug logging for development
    if (this.envValidator.get('NODE_ENV') === 'development') {
      this.logger.debug('Security headers analysis', securityHeaders);
    }
  }

  /**
   * Validate request security
   */
  validateRequestSecurity(req: Request): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for required security headers in sensitive endpoints
    if (req.url?.includes('/auth/') || req.url?.includes('/admin/')) {
      if (!req.get('X-Requested-With')) {
        issues.push('Missing X-Requested-With header for sensitive endpoint');
      }
    }

    // Check for suspicious request patterns
    if (req.url && req.url.length > 2048) {
      issues.push('Excessively long URL detected');
    }

    // Check for SQL injection patterns in URL
    const sqlPatterns = [
      /union.*select/i,
      /drop.*table/i,
      /'.*or.*'/i,
      /exec\s*\(/i,
    ];

    if (sqlPatterns.some((pattern) => pattern.test(req.url || ''))) {
      issues.push('Potential SQL injection pattern in URL');
    }

    // Check for XSS patterns
    const xssPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];

    const queryString = new URLSearchParams(
      req.url?.split('?')[1] || '',
    ).toString();
    if (xssPatterns.some((pattern) => pattern.test(queryString))) {
      issues.push('Potential XSS pattern in query parameters');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

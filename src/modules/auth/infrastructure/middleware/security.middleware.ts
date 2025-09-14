import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as helmet from 'helmet';
import * as compression from 'compression';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly helmetMiddleware: any;
  private readonly compressionMiddleware: any;

  constructor(private readonly configService: ConfigService) {
    // Configure Helmet with security headers
    this.helmetMiddleware = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          fontSrc: ["'self'", 'https:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          childSrc: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for API usage
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'same-origin' },
    });

    // Configure compression
    this.compressionMiddleware = compression({
      filter: (req: Request, res: Response) => {
        // Don't compress responses if the client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }

        // Use compression for all other responses
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9, where 6 is default)
      threshold: 1024, // Only compress responses larger than 1KB
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Apply helmet security headers
    this.helmetMiddleware(req, res, (err: any) => {
      if (err) return next(err);

      // Apply compression
      this.compressionMiddleware(req, res, (compressionErr: any) => {
        if (compressionErr) return next(compressionErr);

        // Add custom security headers
        this.addCustomSecurityHeaders(res);

        next();
      });
    });
  }

  private addCustomSecurityHeaders(res: Response): void {
    // Remove server information
    res.removeHeader('X-Powered-By');

    // Custom security headers
    res.setHeader('X-API-Version', '1.0');
    res.setHeader('X-Request-ID', this.generateRequestId());

    // Prevent caching of sensitive endpoints
    if (this.isSensitiveEndpoint(res.req as Request)) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  }

  private isSensitiveEndpoint(req: Request): boolean {
    const sensitiveEndpoints = ['/auth/', '/user/', '/admin/'];
    return sensitiveEndpoints.some((endpoint) => req.path.includes(endpoint));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

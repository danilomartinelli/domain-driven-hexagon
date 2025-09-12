import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as cors from 'cors';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly corsMiddleware: any;

  constructor(private readonly configService: ConfigService) {
    const allowedOrigins = this.getAllowedOrigins();
    
    this.corsMiddleware = cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (this.isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'Cache-Control',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Request-ID',
        'X-API-Version',
      ],
      credentials: true, // Allow cookies and credentials
      maxAge: 86400, // Cache preflight response for 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.corsMiddleware(req, res, next);
  }

  private getAllowedOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ALLOWED_ORIGINS', '');
    
    // Default allowed origins for development
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    if (!origins) {
      return process.env.NODE_ENV === 'production' ? [] : defaultOrigins;
    }

    return origins.split(',').map(origin => origin.trim()).filter(Boolean);
  }

  private isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    // In development, allow all localhost and 127.0.0.1 origins
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return true;
      }
    }

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // Check wildcard patterns
    return allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return false;
    });
  }
}
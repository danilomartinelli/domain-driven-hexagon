import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

interface RateLimitRule {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
}

interface RateLimitStore {
  [key: string]: {
    requests: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store: RateLimitStore = {};
  private readonly rules: Map<string, RateLimitRule> = new Map();
  private readonly globalRule: RateLimitRule;

  constructor(private readonly configService: ConfigService) {
    // Define global rate limit (applies to all endpoints)
    this.globalRule = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes
      message: 'Too many requests, please try again later',
    };

    // Define endpoint-specific rate limits
    this.setupEndpointRules();

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private setupEndpointRules(): void {
    // Authentication endpoints - more restrictive
    this.rules.set('/auth/login', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 login attempts per 15 minutes per IP
      message: 'Too many login attempts, please try again later',
    });

    this.rules.set('/auth/register', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 registration attempts per hour per IP
      message: 'Too many registration attempts, please try again later',
    });

    this.rules.set('/auth/refresh', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 refresh attempts per minute per IP
      message: 'Too many token refresh attempts, please try again later',
    });

    // Password reset endpoints
    this.rules.set('/auth/forgot-password', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 password reset attempts per hour per IP
      message: 'Too many password reset attempts, please try again later',
    });

    // API endpoints - moderate restrictions
    this.rules.set('/v1/users', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes per IP
      message: 'Too many requests to user endpoints, please try again later',
    });

    // Admin endpoints - strict restrictions
    this.rules.set('/admin/', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requests per 15 minutes per IP
      message: 'Too many requests to admin endpoints, please try again later',
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const clientId = this.getClientIdentifier(req);
    const endpoint = this.getEndpointKey(req.path);

    // Check endpoint-specific rate limit first
    const endpointRule = this.getApplicableRule(req.path);
    if (
      endpointRule &&
      !this.checkRateLimit(clientId, endpoint, endpointRule)
    ) {
      return this.sendRateLimitResponse(res, endpointRule);
    }

    // Check global rate limit
    if (!this.checkRateLimit(clientId, 'global', this.globalRule)) {
      return this.sendRateLimitResponse(res, this.globalRule);
    }

    // Add rate limit headers
    this.addRateLimitHeaders(
      res,
      clientId,
      endpoint,
      endpointRule || this.globalRule,
    );

    next();
  }

  private getClientIdentifier(req: Request): string {
    // Use IP address as primary identifier
    const ip =
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown';

    // For authenticated requests, also consider user ID
    const user = (req as any).user;
    if (user?.sub) {
      return `${ip}:${user.sub}`;
    }

    return ip;
  }

  private getEndpointKey(path: string): string {
    // Normalize path for rate limiting (remove IDs and query params)
    return path
      .replace(/\/\d+/g, '/:id') // Replace numeric IDs
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
      .split('?')[0]; // Remove query parameters
  }

  private getApplicableRule(path: string): RateLimitRule | null {
    // Find the most specific matching rule
    const matchingRules = Array.from(this.rules.entries())
      .filter(([pattern]) => path.includes(pattern))
      .sort((a, b) => b[0].length - a[0].length); // Sort by specificity (longest first)

    return matchingRules.length > 0 ? matchingRules[0][1] : null;
  }

  private checkRateLimit(
    clientId: string,
    endpoint: string,
    rule: RateLimitRule,
  ): boolean {
    const key = `${clientId}:${endpoint}`;
    const now = Date.now();
    // const windowStart = now - rule.windowMs;

    if (!this.store[key]) {
      this.store[key] = {
        requests: 1,
        resetTime: now + rule.windowMs,
      };
      return true;
    }

    const clientData = this.store[key];

    // Reset window if expired
    if (now > clientData.resetTime) {
      clientData.requests = 1;
      clientData.resetTime = now + rule.windowMs;
      return true;
    }

    // Check if within limit
    if (clientData.requests < rule.maxRequests) {
      clientData.requests++;
      return true;
    }

    return false; // Rate limit exceeded
  }

  private addRateLimitHeaders(
    res: Response,
    clientId: string,
    endpoint: string,
    rule: RateLimitRule,
  ): void {
    const key = `${clientId}:${endpoint}`;
    const clientData = this.store[key];

    if (clientData) {
      res.setHeader('X-RateLimit-Limit', rule.maxRequests);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, rule.maxRequests - clientData.requests),
      );
      res.setHeader('X-RateLimit-Reset', clientData.resetTime);
    }
  }

  private sendRateLimitResponse(res: Response, rule: RateLimitRule): void {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: rule.message || 'Too many requests',
      error: 'Too Many Requests',
      timestamp: new Date().toISOString(),
    });
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (now > this.store[key].resetTime) {
        delete this.store[key];
      }
    });
  }
}

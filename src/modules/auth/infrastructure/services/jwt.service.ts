import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtServicePort } from '../../domain/ports/jwt.service.port';
import { JwtPayload, TokenPair, AUTH_CONSTANTS } from '../../domain/auth.types';
import { InvalidTokenError, TokenExpiredError } from '../../domain/auth.errors';
import { LoggerPort } from '@libs/ports/logger.port';
import { randomUUID } from 'crypto';

@Injectable()
export class JwtService implements JwtServicePort {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    this.accessTokenSecret = this.configService.getOrThrow<string>(
      'JWT_ACCESS_TOKEN_SECRET',
    );
    this.refreshTokenSecret = this.configService.getOrThrow<string>(
      'JWT_REFRESH_TOKEN_SECRET',
    );
    this.accessTokenExpiresIn = `${AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN_MINUTES}m`;
    this.refreshTokenExpiresIn = `${AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN_DAYS}d`;
  }

  async generateTokenPair(payload: JwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken({ ...payload, tokenType: 'access' }),
      this.generateRefreshToken({ ...payload, tokenType: 'refresh' }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN_MINUTES * 60, // seconds
      tokenType: 'Bearer',
    };
  }

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    try {
      const tokenPayload = {
        ...payload,
        tokenType: 'access',
        jti: randomUUID(), // JWT ID for token identification
      };

      const token = await this.nestJwtService.signAsync(tokenPayload, {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiresIn,
      });

      this.logger.debug('Access token generated successfully', {
        userId: payload.sub,
        email: payload.email,
      });

      return token;
    } catch (error) {
      this.logger.error('Failed to generate access token', {
        userId: payload.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async generateRefreshToken(payload: JwtPayload): Promise<string> {
    try {
      const tokenPayload = {
        sub: payload.sub,
        email: payload.email,
        tokenType: 'refresh',
        jti: randomUUID(), // JWT ID for token identification
      };

      const token = await this.nestJwtService.signAsync(tokenPayload, {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiresIn,
      });

      this.logger.debug('Refresh token generated successfully', {
        userId: payload.sub,
        email: payload.email,
      });

      return token;
    } catch (error) {
      this.logger.error('Failed to generate refresh token', {
        userId: payload.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.nestJwtService.verifyAsync(token, {
        secret: this.accessTokenSecret,
      });

      if (payload.tokenType !== 'access') {
        throw new InvalidTokenError('Token is not an access token');
      }

      this.logger.debug('Access token verified successfully', {
        userId: payload.sub,
        email: payload.email,
      });

      return payload as JwtPayload;
    } catch (error) {
      this.logger.warn('Access token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.nestJwtService.verifyAsync(token, {
        secret: this.refreshTokenSecret,
      });

      if (payload.tokenType !== 'refresh') {
        throw new InvalidTokenError('Token is not a refresh token');
      }

      this.logger.debug('Refresh token verified successfully', {
        userId: payload.sub,
        email: payload.email,
      });

      return payload as JwtPayload;
    } catch (error) {
      this.logger.warn('Refresh token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = this.nestJwtService.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      this.logger.warn('Token decode failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTimestamp;
    } catch {
      return true;
    }
  }
}

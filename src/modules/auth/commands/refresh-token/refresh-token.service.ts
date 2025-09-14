import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { RefreshTokenCommand } from './refresh-token.command';
import { TokenPair } from '../../domain/auth.types';
import {
  InvalidTokenError,
  RefreshTokenNotFoundError,
  AccountInactiveError,
} from '../../domain/auth.errors';
import { UserRepositoryPort } from '@modules/user/database/user.repository.port';
import { RefreshTokenRepositoryPort } from '../../database/refresh-token.repository.port';
import { AuthAuditLogRepositoryPort } from '../../database/auth-audit-log.repository.port';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';
import { AUTH_DI_TOKENS } from '../../auth.di-tokens';
import { JwtServicePort } from '../../domain/ports/jwt.service.port';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import { AuthAuditLogEntity } from '../../domain/entities/auth-audit-log.entity';
import { LoggerPort } from '@libs/ports/logger.port';
import { AUTH_CONSTANTS } from '../../domain/auth.types';

@CommandHandler(RefreshTokenCommand)
@Injectable()
export class RefreshTokenService
  implements ICommandHandler<RefreshTokenCommand>
{
  constructor(
    @Inject(USER_DI_TOKENS.UserRepository)
    private readonly userRepo: UserRepositoryPort,
    @Inject(AUTH_DI_TOKENS.JwtService)
    private readonly jwtService: JwtServicePort,
    @Inject(AUTH_DI_TOKENS.RefreshTokenRepository)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
    @Inject(AUTH_DI_TOKENS.AuthAuditLogRepository)
    private readonly auditLogRepo: AuthAuditLogRepositoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    command: RefreshTokenCommand,
  ): Promise<Result<TokenPair, Error>> {
    const { refreshToken, ipAddress, userAgent } = command;

    try {
      // Verify the refresh token JWT
      let tokenPayload;
      try {
        tokenPayload = await this.jwtService.verifyRefreshToken(refreshToken);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await this.logFailedAttempt(
          undefined,
          'REFRESH_TOKEN_INVALID_JWT',
          { error: errorMessage },
          ipAddress,
          userAgent,
        );
        return Err(new InvalidTokenError());
      }

      // Find the refresh token in database
      const refreshTokenOption =
        await this.refreshTokenRepo.findByToken(refreshToken);
      if (refreshTokenOption.isNone()) {
        await this.logFailedAttempt(
          tokenPayload.sub,
          'REFRESH_TOKEN_NOT_FOUND',
          {},
          ipAddress,
          userAgent,
        );
        return Err(new RefreshTokenNotFoundError());
      }

      const refreshTokenEntity = refreshTokenOption.unwrap();

      // Check if token is active (not revoked and not expired)
      if (!refreshTokenEntity.isActive) {
        await this.logFailedAttempt(
          tokenPayload.sub,
          'REFRESH_TOKEN_INACTIVE',
          {
            isRevoked: refreshTokenEntity.isRevoked,
            isExpired: refreshTokenEntity.isExpired,
          },
          ipAddress,
          userAgent,
        );
        return Err(new RefreshTokenNotFoundError());
      }

      // Find the user
      const userOption = await this.userRepo.findOneById(tokenPayload.sub);
      if (userOption.isNone()) {
        await this.logFailedAttempt(
          tokenPayload.sub,
          'REFRESH_TOKEN_USER_NOT_FOUND',
          {},
          ipAddress,
          userAgent,
        );
        return Err(new InvalidTokenError());
      }

      const user = userOption.unwrap();
      const userProps = user.getProps();

      // Check if user account is still active
      if (!userProps.isActive) {
        await this.logFailedAttempt(
          user.id,
          'REFRESH_TOKEN_USER_INACTIVE',
          {},
          ipAddress,
          userAgent,
        );
        return Err(new AccountInactiveError());
      }

      // Generate new token pair
      const userRoles = await this.getUserRoles(user.id);
      const userPermissions = await this.getUserPermissions(user.id);

      const newTokenPair = await this.jwtService.generateTokenPair({
        sub: user.id,
        email: userProps.email,
        roles: userRoles,
        permissions: userPermissions,
        tokenType: 'access', // Will be overridden by the service
      });

      // Revoke the old refresh token and store the new one
      refreshTokenEntity.revoke(ipAddress, newTokenPair.refreshToken);
      await this.refreshTokenRepo.update(refreshTokenEntity);

      // Store the new refresh token
      await this.storeRefreshToken(
        user.id,
        newTokenPair.refreshToken,
        ipAddress,
        userAgent,
      );

      // Log successful token refresh
      await this.logSuccessfulAttempt(
        user.id,
        'REFRESH_TOKEN_SUCCESS',
        { roles: userRoles },
        ipAddress,
        userAgent,
      );

      this.logger.log('Refresh token used successfully', {
        userId: user.id,
        email: userProps.email,
        ipAddress,
      });

      return Ok(newTokenPair);
    } catch (error) {
      this.logger.error('Refresh token command execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });

      return Err(
        error instanceof Error ? error : new Error('Token refresh failed'),
      );
    }
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const refreshToken = RefreshTokenEntity.create({
      token,
      userId,
      expiresAt: new Date(
        Date.now() +
          AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
      ),
      createdByIp: ipAddress,
      userAgent,
    });

    await this.refreshTokenRepo.insert(refreshToken);
  }

  private async logSuccessfulAttempt(
    userId: string,
    action: string,
    details: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const auditLog = AuthAuditLogEntity.create({
      userId,
      action,
      details,
      ipAddress,
      userAgent,
      success: true,
    });

    await this.auditLogRepo.insert(auditLog);
  }

  private async logFailedAttempt(
    userId: string | undefined,
    action: string,
    details: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const auditLog = AuthAuditLogEntity.create({
      userId,
      action,
      details,
      ipAddress,
      userAgent,
      success: false,
    });

    await this.auditLogRepo.insert(auditLog);
  }

  // These methods would be implemented based on your role/permission system
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getUserRoles(_userId: string): Promise<string[]> {
    // Implementation would query user roles
    return ['user']; // This should be replaced with actual role lookup
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getUserPermissions(_userId: string): Promise<string[]> {
    // Implementation would query user permissions via roles
    return ['user:read-own', 'wallet:read-own']; // This should be replaced with actual permission lookup
  }
}

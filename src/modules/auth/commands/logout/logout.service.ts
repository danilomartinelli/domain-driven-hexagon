import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { LogoutCommand } from './logout.command';
import { RefreshTokenRepositoryPort } from '../../database/refresh-token.repository.port';
import { AuthAuditLogRepositoryPort } from '../../database/auth-audit-log.repository.port';
import { AUTH_DI_TOKENS } from '../../auth.di-tokens';
import { AuthAuditLogEntity } from '../../domain/entities/auth-audit-log.entity';
import { LoggerPort } from '@libs/ports/logger.port';

@CommandHandler(LogoutCommand)
@Injectable()
export class LogoutService implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(AUTH_DI_TOKENS.RefreshTokenRepository)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
    @Inject(AUTH_DI_TOKENS.AuthAuditLogRepository)
    private readonly auditLogRepo: AuthAuditLogRepositoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: LogoutCommand): Promise<Result<boolean, Error>> {
    const { userId, refreshToken, ipAddress, userAgent, logoutAllDevices } =
      command;

    try {
      if (logoutAllDevices) {
        // Revoke all refresh tokens for the user
        await this.refreshTokenRepo.revokeAllUserTokens(userId, ipAddress);

        await this.logSuccessfulAttempt(
          userId,
          'LOGOUT_ALL_DEVICES',
          { deviceCount: 'all' },
          ipAddress,
          userAgent,
        );

        this.logger.log('User logged out from all devices', {
          userId,
          ipAddress,
        });
      } else if (refreshToken) {
        // Revoke specific refresh token
        await this.refreshTokenRepo.revokeToken(refreshToken, ipAddress);

        await this.logSuccessfulAttempt(
          userId,
          'LOGOUT_SINGLE_DEVICE',
          { tokenProvided: true },
          ipAddress,
          userAgent,
        );

        this.logger.log('User logged out from single device', {
          userId,
          ipAddress,
        });
      } else {
        // No refresh token provided, log the logout attempt anyway
        await this.logSuccessfulAttempt(
          userId,
          'LOGOUT_NO_TOKEN',
          { tokenProvided: false },
          ipAddress,
          userAgent,
        );

        this.logger.log('User logout attempt without refresh token', {
          userId,
          ipAddress,
        });
      }

      return Ok(true);
    } catch (error) {
      this.logger.error('Logout command execution failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });

      await this.logFailedAttempt(
        userId,
        'LOGOUT_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        userAgent,
      );

      return Err(error instanceof Error ? error : new Error('Logout failed'));
    }
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
      success: false,
    });

    await this.auditLogRepo.insert(auditLog);
  }
}

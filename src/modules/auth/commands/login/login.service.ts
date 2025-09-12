import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { LoginCommand } from './login.command';
import { TokenPair } from '../../domain/auth.types';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountInactiveError,
  EmailNotVerifiedError,
} from '../../domain/auth.errors';
import { UserRepositoryPort } from '@modules/user/database/user.repository.port';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';
import { AUTH_DI_TOKENS } from '../../auth.di-tokens';
import { JwtServicePort } from '../../domain/ports/jwt.service.port';
import { PasswordServicePort } from '../../domain/ports/password.service.port';
import { RefreshTokenRepositoryPort } from '../../database/refresh-token.repository.port';
import { AuthAuditLogRepositoryPort } from '../../database/auth-audit-log.repository.port';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import { AuthAuditLogEntity } from '../../domain/entities/auth-audit-log.entity';
import { LoggerPort } from '@libs/ports/logger.port';
import { AUTH_CONSTANTS } from '../../domain/auth.types';

@CommandHandler(LoginCommand)
@Injectable()
export class LoginService implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(USER_DI_TOKENS.UserRepository)
    private readonly userRepo: UserRepositoryPort,
    @Inject(AUTH_DI_TOKENS.JwtService)
    private readonly jwtService: JwtServicePort,
    @Inject(AUTH_DI_TOKENS.PasswordService)
    private readonly passwordService: PasswordServicePort,
    @Inject(AUTH_DI_TOKENS.RefreshTokenRepository)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
    @Inject(AUTH_DI_TOKENS.AuthAuditLogRepository)
    private readonly auditLogRepo: AuthAuditLogRepositoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: LoginCommand): Promise<Result<TokenPair, Error>> {
    const { email, password, ipAddress, userAgent } = command;

    try {
      // Find user by email
      const userOption = await this.userRepo.findByEmail(email);
      
      if (userOption.isNone()) {
        await this.logFailedAttempt(undefined, 'LOGIN_INVALID_EMAIL', { email }, ipAddress, userAgent);
        return Err(new InvalidCredentialsError());
      }

      const user = userOption.unwrap();
      const userProps = user.getProps();

      // Check if account is locked
      if (userProps.lockedUntil && userProps.lockedUntil > new Date()) {
        await this.logFailedAttempt(user.id, 'LOGIN_ACCOUNT_LOCKED', { lockExpires: userProps.lockedUntil }, ipAddress, userAgent);
        return Err(new AccountLockedError());
      }

      // Check if account is active
      if (!userProps.isActive) {
        await this.logFailedAttempt(user.id, 'LOGIN_ACCOUNT_INACTIVE', {}, ipAddress, userAgent);
        return Err(new AccountInactiveError());
      }

      // Check if email is verified
      if (!userProps.isEmailVerified) {
        await this.logFailedAttempt(user.id, 'LOGIN_EMAIL_NOT_VERIFIED', {}, ipAddress, userAgent);
        return Err(new EmailNotVerifiedError());
      }

      // Verify password
      if (!userProps.password) {
        await this.logFailedAttempt(user.id, 'LOGIN_NO_PASSWORD_SET', {}, ipAddress, userAgent);
        return Err(new InvalidCredentialsError());
      }

      const isPasswordValid = await this.passwordService.compare(password, userProps.password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await this.handleFailedLogin(user, ipAddress, userAgent);
        return Err(new InvalidCredentialsError());
      }

      // Reset login attempts on successful login
      await this.handleSuccessfulLogin(user, ipAddress, userAgent);

      // Get user roles and permissions for JWT payload
      const userRoles = await this.getUserRoles(user.id);
      const userPermissions = await this.getUserPermissions(user.id);

      // Generate JWT tokens
      const tokenPair = await this.jwtService.generateTokenPair({
        sub: user.id,
        email: userProps.email,
        roles: userRoles,
        permissions: userPermissions,
        tokenType: 'access', // Will be overridden by the service
      });

      // Store refresh token
      await this.storeRefreshToken(user.id, tokenPair.refreshToken, ipAddress, userAgent);

      // Log successful login
      await this.logSuccessfulAttempt(user.id, 'LOGIN_SUCCESS', { roles: userRoles }, ipAddress, userAgent);

      this.logger.log('User logged in successfully', {
        userId: user.id,
        email: userProps.email,
        ipAddress,
      });

      return Ok(tokenPair);
    } catch (error) {
      this.logger.error('Login command execution failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });

      return Err(error instanceof Error ? error : new Error('Login failed'));
    }
  }

  private async handleFailedLogin(user: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const userProps = user.getProps();
    const attempts = userProps.loginAttempts + 1;

    // Update login attempts
    user.updateAuthProps({
      loginAttempts: attempts,
      lockedUntil: attempts >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS 
        ? new Date(Date.now() + AUTH_CONSTANTS.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000)
        : undefined,
    });

    await this.userRepo.update(user);

    await this.logFailedAttempt(
      user.id, 
      attempts >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS ? 'LOGIN_ACCOUNT_LOCKED_ATTEMPTS' : 'LOGIN_INVALID_PASSWORD',
      { attempts, maxAttempts: AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS }, 
      ipAddress, 
      userAgent
    );
  }

  private async handleSuccessfulLogin(user: any, ipAddress?: string, userAgent?: string): Promise<void> {
    // Reset login attempts and update last login
    user.updateAuthProps({
      loginAttempts: 0,
      lockedUntil: undefined,
      lastLoginAt: new Date(),
    });

    await this.userRepo.update(user);
  }

  private async storeRefreshToken(userId: string, token: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const refreshToken = RefreshTokenEntity.create({
      token,
      userId,
      expiresAt: new Date(Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
      createdByIp: ipAddress,
      userAgent,
    });

    await this.refreshTokenRepo.insert(refreshToken);
  }

  private async logSuccessfulAttempt(userId: string, action: string, details: any, ipAddress?: string, userAgent?: string): Promise<void> {
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

  private async logFailedAttempt(userId: string | undefined, action: string, details: any, ipAddress?: string, userAgent?: string): Promise<void> {
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

  // These methods would be implemented based on your user repository structure
  private async getUserRoles(userId: string): Promise<string[]> {
    // Implementation would query user roles
    // For now, return empty array or mock data
    return ['user']; // This should be replaced with actual role lookup
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    // Implementation would query user permissions via roles
    // For now, return empty array or mock data
    return ['user:read-own', 'wallet:read-own']; // This should be replaced with actual permission lookup
  }
}
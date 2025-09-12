import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { RegisterCommand } from './register.command';
import { UserEntity } from '@modules/user/domain/user.entity';
import { Address } from '@modules/user/domain/value-objects/address.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { UserAlreadyExistsError } from '@modules/user/domain/user.errors';
import { PasswordMismatchError } from '../../domain/auth.errors';
import { UserRepositoryPort } from '@modules/user/database/user.repository.port';
import { RoleRepositoryPort } from '../../database/role.repository.port';
import { AuthAuditLogRepositoryPort } from '../../database/auth-audit-log.repository.port';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';
import { AUTH_DI_TOKENS } from '../../auth.di-tokens';
import { PasswordServicePort } from '../../domain/ports/password.service.port';
import { AuthAuditLogEntity } from '../../domain/entities/auth-audit-log.entity';
import { LoggerPort } from '@libs/ports/logger.port';
import { AggregateID } from '@libs/ddd';

@CommandHandler(RegisterCommand)
@Injectable()
export class RegisterService implements ICommandHandler<RegisterCommand> {
  constructor(
    @Inject(USER_DI_TOKENS.UserRepository)
    private readonly userRepo: UserRepositoryPort,
    @Inject(AUTH_DI_TOKENS.RoleRepository)
    private readonly roleRepo: RoleRepositoryPort,
    @Inject(AUTH_DI_TOKENS.PasswordService)
    private readonly passwordService: PasswordServicePort,
    @Inject(AUTH_DI_TOKENS.AuthAuditLogRepository)
    private readonly auditLogRepo: AuthAuditLogRepositoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: RegisterCommand): Promise<Result<AggregateID, Error>> {
    const { email, password, confirmPassword, address, ipAddress, userAgent } = command;

    try {
      // Validate password confirmation
      if (password !== confirmPassword) {
        await this.logFailedAttempt('REGISTER_PASSWORD_MISMATCH', { email }, ipAddress, userAgent);
        return Err(new PasswordMismatchError());
      }

      // Check if user already exists
      const existingUserOption = await this.userRepo.findByEmail(email);
      if (existingUserOption.isSome()) {
        await this.logFailedAttempt('REGISTER_USER_EXISTS', { email }, ipAddress, userAgent);
        return Err(new UserAlreadyExistsError());
      }

      // Create password value object (this will validate the password)
      const passwordVO = Password.create(password);
      const hashedPassword = await passwordVO.hash();

      // Create address value object
      const addressVO = new Address(address);

      // Generate email verification token
      const emailVerificationToken = this.passwordService.generateSecureToken();

      // Create user entity with authentication fields
      const user = UserEntity.createWithAuth({
        email,
        address: addressVO,
        password: hashedPassword.value,
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken,
        loginAttempts: 0,
      });

      // Assign default user role
      const defaultRoleOption = await this.roleRepo.findByName('user');
      if (defaultRoleOption.isSome()) {
        const defaultRole = defaultRoleOption.unwrap();
        await this.roleRepo.assignRoleToUser(user.id, defaultRole.id);
      }

      // Save user
      await this.userRepo.insert(user);

      // Log successful registration
      await this.logSuccessfulAttempt(user.id, 'REGISTER_SUCCESS', { email }, ipAddress, userAgent);

      this.logger.log('User registered successfully', {
        userId: user.id,
        email,
        ipAddress,
      });

      // TODO: Send email verification email
      // await this.emailService.sendVerificationEmail(email, emailVerificationToken);

      return Ok(user.id);
    } catch (error) {
      this.logger.error('Register command execution failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });

      return Err(error instanceof Error ? error : new Error('Registration failed'));
    }
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

  private async logFailedAttempt(action: string, details: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const auditLog = AuthAuditLogEntity.create({
      action,
      details,
      ipAddress,
      userAgent,
      success: false,
    });

    await this.auditLogRepo.insert(auditLog);
  }
}
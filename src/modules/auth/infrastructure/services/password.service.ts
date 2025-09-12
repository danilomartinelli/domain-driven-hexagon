import { Injectable } from '@nestjs/common';
import { PasswordServicePort } from '../../domain/ports/password.service.port';
import { Password } from '../../domain/value-objects/password.value-object';
import { WeakPasswordError } from '../../domain/auth.errors';
import { LoggerPort } from '@libs/ports/logger.port';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService implements PasswordServicePort {
  private static readonly SALT_ROUNDS = 12;

  constructor(private readonly logger: LoggerPort) {}

  async hash(password: Password): Promise<string> {
    try {
      if (password.isHashed) {
        return password.value;
      }

      const hashedPassword = await password.hash();
      return hashedPassword.value;
    } catch (error) {
      this.logger.error('Failed to hash password', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      this.logger.error('Failed to compare password', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async validate(password: string): Promise<boolean> {
    try {
      const passwordVO = Password.create(password);
      passwordVO.validate();
      return true;
    } catch (error) {
      if (error instanceof WeakPasswordError) {
        return false;
      }
      this.logger.error('Password validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  generateSecureToken(): string {
    // Generate a cryptographically secure random token
    return crypto.randomBytes(32).toString('hex');
  }

  generateResetToken(): string {
    // Generate a shorter but still secure token for password resets
    return crypto.randomBytes(20).toString('hex');
  }
}
import { Password } from '../value-objects/password.value-object';

export interface PasswordServicePort {
  hash(password: Password): Promise<string>;
  compare(plainPassword: string, hashedPassword: string): Promise<boolean>;
  validate(password: string): Promise<boolean>;
  generateSecureToken(): string;
  generateResetToken(): string;
}
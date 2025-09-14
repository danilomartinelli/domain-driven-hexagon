import { ValueObject } from '@libs/ddd/value-object.base';
import { Guard } from '@libs/guard';
import { WeakPasswordError } from '../auth.errors';
import { AUTH_CONSTANTS } from '../auth.types';
import * as bcrypt from 'bcrypt';

export interface PasswordProps {
  value: string;
  isHashed?: boolean;
}

export class Password extends ValueObject<PasswordProps> {
  private static readonly SALT_ROUNDS = 12;
  private static readonly PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

  constructor(props: PasswordProps) {
    super(props);
    this.validate();
  }

  static create(plainTextPassword: string): Password {
    return new Password({ value: plainTextPassword, isHashed: false });
  }

  static fromHash(hashedPassword: string): Password {
    return new Password({ value: hashedPassword, isHashed: true });
  }

  get value(): string {
    return this.props.value;
  }

  get isHashed(): boolean {
    return this.props.isHashed ?? false;
  }

  async hash(): Promise<Password> {
    if (this.isHashed) {
      return this;
    }

    const hashedValue = await bcrypt.hash(
      this.props.value,
      Password.SALT_ROUNDS,
    );
    return new Password({ value: hashedValue, isHashed: true });
  }

  async compare(plainTextPassword: string): Promise<boolean> {
    if (!this.isHashed) {
      throw new Error('Cannot compare against unhashed password');
    }

    return bcrypt.compare(plainTextPassword, this.props.value);
  }

  validate(): void {
    // Skip validation for already hashed passwords
    if (this.isHashed) {
      return;
    }

    const { value } = this.props;

    // Length validation
    if (
      !Guard.lengthIsBetween(
        value,
        AUTH_CONSTANTS.MIN_PASSWORD_LENGTH,
        AUTH_CONSTANTS.MAX_PASSWORD_LENGTH,
      )
    ) {
      throw new WeakPasswordError(
        `Password must be between ${AUTH_CONSTANTS.MIN_PASSWORD_LENGTH} and ${AUTH_CONSTANTS.MAX_PASSWORD_LENGTH} characters`,
      );
    }

    // Complexity validation
    if (!Password.PASSWORD_REGEX.test(value)) {
      throw new WeakPasswordError(
        'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
      );
    }

    // Common password patterns to avoid
    const commonPatterns = [
      /(.)\1{3,}/, // Four or more repeated characters
      /123456|qwerty|password|admin/i, // Common passwords
      /^[a-zA-Z]+$/, // Only letters
      /^[0-9]+$/, // Only numbers
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(value)) {
        throw new WeakPasswordError(
          'Password contains common patterns and is not secure',
        );
      }
    }
  }

  protected *getEqualityComponents(): Generator<unknown, void, unknown> {
    yield this.props.value;
    yield this.props.isHashed;
  }
}

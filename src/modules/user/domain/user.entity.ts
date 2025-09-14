import { AggregateRoot, AggregateID } from '@libs/ddd';
import { UserCreatedDomainEvent } from './events/user-created.domain-event';
import { Address, AddressProps } from './value-objects/address.value-object';
import {
  CreateUserProps,
  CreateUserAuthProps,
  UpdateUserAddressProps,
  UpdateUserAuthProps,
  UserProps,
  UserRoles,
} from './user.types';
import { UserDeletedDomainEvent } from './events/user-deleted.domain-event';
import { UserRoleChangedDomainEvent } from './events/user-role-changed.domain-event';
import { UserAddressUpdatedDomainEvent } from './events/user-address-updated.domain-event';
import { Guard } from '@libs/guard';
import { randomUUID } from 'crypto';

export class UserEntity extends AggregateRoot<UserProps> {
  protected readonly _id: AggregateID;

  static create(create: CreateUserProps): UserEntity {
    const id = randomUUID();
    /* Setting a default role since we are not accepting it during creation. */
    const props: UserProps = {
      ...create,
      role: UserRoles.guest,
      isActive: true,
      isEmailVerified: false,
      loginAttempts: 0,
    };
    const user = new UserEntity({ id, props });
    /* adding "UserCreated" Domain Event that will be published
    eventually so an event handler somewhere may receive it and do an
    appropriate action. Multiple events can be added if needed. */
    user.addEvent(
      new UserCreatedDomainEvent({
        aggregateId: id,
        email: props.email,
        ...props.address.unpack(),
      }),
    );
    return user;
  }

  static createWithAuth(create: CreateUserAuthProps): UserEntity {
    const id = randomUUID();
    const props: UserProps = {
      ...create,
      role: UserRoles.guest,
      isActive: create.isActive ?? true,
      isEmailVerified: create.isEmailVerified ?? false,
      loginAttempts: create.loginAttempts ?? 0,
    };
    const user = new UserEntity({ id, props });
    user.addEvent(
      new UserCreatedDomainEvent({
        aggregateId: id,
        email: props.email,
        ...props.address.unpack(),
      }),
    );
    return user;
  }

  /* You can create getters only for the properties that you need to
  access and leave the rest of the properties private to keep entity
  encapsulated. To get all entity properties (for saving it to a
  database or mapping a response) use .getProps() method
  defined in a EntityBase parent class */
  get role(): UserRoles {
    return this.props.role;
  }

  private changeRole(newRole: UserRoles): void {
    this.addEvent(
      new UserRoleChangedDomainEvent({
        aggregateId: this.id,
        oldRole: this.props.role,
        newRole,
      }),
    );

    this.props.role = newRole;
  }

  makeAdmin(): void {
    this.changeRole(UserRoles.admin);
  }

  makeModerator(): void {
    this.changeRole(UserRoles.moderator);
  }

  delete(): void {
    this.addEvent(
      new UserDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  /* Update method only changes properties that we allow, in this
   case only address. This prevents from illegal actions, 
   for example setting email from outside by doing something
   like user.email = otherEmail */
  updateAddress(props: UpdateUserAddressProps): void {
    const newAddress = new Address({
      ...this.props.address,
      ...props,
    } as AddressProps);

    this.props.address = newAddress;

    this.addEvent(
      new UserAddressUpdatedDomainEvent({
        aggregateId: this.id,
        country: newAddress.country,
        street: newAddress.street,
        postalCode: newAddress.postalCode,
      }),
    );
  }

  /* Authentication-related getters */
  get isActive(): boolean {
    return this.props.isActive;
  }

  get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }

  get loginAttempts(): number {
    return this.props.loginAttempts;
  }

  get isLocked(): boolean {
    return this.props.lockedUntil ? this.props.lockedUntil > new Date() : false;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  /* Authentication-related methods */
  updateAuthProps(props: UpdateUserAuthProps): void {
    Object.assign(this.props, props);
  }

  verifyEmail(): void {
    this.props.isEmailVerified = true;
    this.props.emailVerificationToken = undefined;
  }

  generateEmailVerificationToken(token: string): void {
    this.props.emailVerificationToken = token;
  }

  generatePasswordResetToken(token: string, expiresAt: Date): void {
    this.props.passwordResetToken = token;
    this.props.passwordResetTokenExpiresAt = expiresAt;
  }

  clearPasswordResetToken(): void {
    this.props.passwordResetToken = undefined;
    this.props.passwordResetTokenExpiresAt = undefined;
  }

  updatePassword(hashedPassword: string): void {
    this.props.password = hashedPassword;
    this.clearPasswordResetToken();
  }

  activate(): void {
    this.props.isActive = true;
  }

  deactivate(): void {
    this.props.isActive = false;
  }

  incrementLoginAttempts(): void {
    this.props.loginAttempts += 1;
  }

  resetLoginAttempts(): void {
    this.props.loginAttempts = 0;
    this.props.lockedUntil = undefined;
  }

  lockAccount(lockDurationMs: number): void {
    this.props.lockedUntil = new Date(Date.now() + lockDurationMs);
  }

  updateLastLogin(): void {
    this.props.lastLoginAt = new Date();
  }

  validate(): void {
    // entity business rules validation to protect it's invariant before saving entity to a database
    this.validateEmail();
    this.validateAddress();
    this.validateAuthenticationFields();
    this.validateRolePermissions();
  }

  private validateEmail(): void {
    if (!Guard.isValidEmail(this.props.email)) {
      throw new Error('Invalid email format');
    }
  }

  private validateAddress(): void {
    if (!this.props.address) {
      throw new Error('Address is required');
    }

    // Address validation is handled by the Address value object itself during construction
    // The address is already validated when created, so we just verify it exists
    if (
      !this.props.address.country ||
      !this.props.address.street ||
      !this.props.address.postalCode
    ) {
      throw new Error(
        'Address must have all required fields: country, street, and postalCode',
      );
    }
  }

  private validateAuthenticationFields(): void {
    // Validate login attempts using type-safe guard
    if (!Guard.isNonNegativeNumber(this.props.loginAttempts)) {
      throw new Error('Login attempts must be a non-negative number');
    }

    if (this.props.loginAttempts > 100) {
      throw new Error('Login attempts exceeded maximum limit');
    }

    // Auto-cleanup expired lock
    this.cleanupExpiredLock();

    // Auto-cleanup expired password reset token
    this.cleanupExpiredPasswordResetToken();

    // Validate token consistency
    this.validatePasswordResetTokenConsistency();
  }

  private cleanupExpiredLock(): void {
    if (this.props.lockedUntil && Guard.isValidDate(this.props.lockedUntil)) {
      if (this.props.lockedUntil < new Date()) {
        this.props.lockedUntil = undefined;
      }
    }
  }

  private cleanupExpiredPasswordResetToken(): void {
    if (
      this.props.passwordResetTokenExpiresAt &&
      Guard.isValidDate(this.props.passwordResetTokenExpiresAt)
    ) {
      if (this.props.passwordResetTokenExpiresAt < new Date()) {
        this.props.passwordResetToken = undefined;
        this.props.passwordResetTokenExpiresAt = undefined;
      }
    }
  }

  private validatePasswordResetTokenConsistency(): void {
    const hasToken = Guard.isNonEmptyString(this.props.passwordResetToken);
    const hasExpiration = Guard.isValidDate(
      this.props.passwordResetTokenExpiresAt,
    );

    if (hasToken && !hasExpiration) {
      throw new Error('Password reset token must have expiration date');
    }

    if (!hasToken && hasExpiration) {
      throw new Error('Password reset expiration date without token');
    }
  }

  private validateRolePermissions(): void {
    if (!Object.values(UserRoles).includes(this.props.role)) {
      throw new Error(`Invalid user role: ${this.props.role}`);
    }

    // Business rule: Admin users must have verified email
    if (this.props.role === UserRoles.admin && !this.props.isEmailVerified) {
      throw new Error('Admin users must have verified email');
    }

    // Business rule: Admin users must be active
    if (this.props.role === UserRoles.admin && !this.props.isActive) {
      throw new Error('Admin users must be active');
    }
  }
}

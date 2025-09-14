import { Specification } from '@libs/ddd';
import { UserEntity } from '../user.entity';
import { UserRoles } from '../user.types';
import {
  OptimizedPasswordValidator,
  DEFAULT_PASSWORD_CONFIG,
} from '@libs/security/password-validator';

/**
 * Base specification interface for User entity business rules
 */
export interface UserSpecification extends Specification<UserEntity> {
  readonly name: string;
  readonly description: string;
}

/**
 * Abstract base class for User specifications with common functionality
 */
export abstract class BaseUserSpecification implements UserSpecification {
  abstract readonly name: string;
  abstract readonly description: string;

  abstract isSatisfiedBy(user: UserEntity): boolean;

  and(other: UserSpecification): UserSpecification {
    return new AndUserSpecification(this, other);
  }

  or(other: UserSpecification): UserSpecification {
    return new OrUserSpecification(this, other);
  }

  not(): UserSpecification {
    return new NotUserSpecification(this);
  }
}

/**
 * Composite specifications
 */
class AndUserSpecification extends BaseUserSpecification {
  readonly name = 'AND_COMPOSITE';
  readonly description: string;

  constructor(
    private readonly left: UserSpecification,
    private readonly right: UserSpecification,
  ) {
    super();
    this.description = `(${left.description}) AND (${right.description})`;
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return this.left.isSatisfiedBy(user) && this.right.isSatisfiedBy(user);
  }
}

class OrUserSpecification extends BaseUserSpecification {
  readonly name = 'OR_COMPOSITE';
  readonly description: string;

  constructor(
    private readonly left: UserSpecification,
    private readonly right: UserSpecification,
  ) {
    super();
    this.description = `(${left.description}) OR (${right.description})`;
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return this.left.isSatisfiedBy(user) || this.right.isSatisfiedBy(user);
  }
}

class NotUserSpecification extends BaseUserSpecification {
  readonly name = 'NOT_COMPOSITE';
  readonly description: string;

  constructor(private readonly specification: UserSpecification) {
    super();
    this.description = `NOT (${specification.description})`;
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return !this.specification.isSatisfiedBy(user);
  }
}

/**
 * User account status specifications
 */
export class UserIsActiveSpecification extends BaseUserSpecification {
  readonly name = 'USER_IS_ACTIVE';
  readonly description = 'User account is active';

  isSatisfiedBy(user: UserEntity): boolean {
    return user.isActive;
  }
}

export class UserIsEmailVerifiedSpecification extends BaseUserSpecification {
  readonly name = 'USER_EMAIL_VERIFIED';
  readonly description = 'User email is verified';

  isSatisfiedBy(user: UserEntity): boolean {
    return user.isEmailVerified;
  }
}

export class UserIsNotLockedSpecification extends BaseUserSpecification {
  readonly name = 'USER_NOT_LOCKED';
  readonly description = 'User account is not locked';

  isSatisfiedBy(user: UserEntity): boolean {
    return !user.isLocked;
  }
}

/**
 * User authentication security specifications
 */
export class UserHasSecurePasswordSpecification extends BaseUserSpecification {
  readonly name = 'USER_SECURE_PASSWORD';
  readonly description = 'User has a secure password';

  private readonly passwordValidator = new OptimizedPasswordValidator(
    DEFAULT_PASSWORD_CONFIG,
  );

  isSatisfiedBy(user: UserEntity): boolean {
    const userProps = user.getProps();

    if (!userProps.password) {
      return false; // No password set
    }

    const validation = this.passwordValidator.validate(userProps.password);
    return validation.isValid && validation.score >= 70; // Minimum security score
  }
}

export class UserLoginAttemptsWithinLimitSpecification extends BaseUserSpecification {
  readonly name = 'USER_LOGIN_ATTEMPTS_OK';
  readonly description = 'User login attempts are within acceptable limits';

  constructor(private readonly maxAttempts: number = 5) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return user.loginAttempts < this.maxAttempts;
  }
}

export class UserLastLoginRecentSpecification extends BaseUserSpecification {
  readonly name = 'USER_RECENT_LOGIN';
  readonly description = 'User has logged in recently';

  constructor(private readonly maxDaysInactive: number = 90) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    if (!user.lastLoginAt) {
      return false; // Never logged in
    }

    const daysSinceLogin =
      (Date.now() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLogin <= this.maxDaysInactive;
  }
}

/**
 * User role and permission specifications
 */
export class UserHasRoleSpecification extends BaseUserSpecification {
  readonly name = 'USER_HAS_ROLE';
  readonly description: string;

  constructor(private readonly requiredRole: UserRoles) {
    super();
    this.description = `User has role: ${requiredRole}`;
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return user.role === this.requiredRole;
  }
}

export class UserCanModerateSpecification extends BaseUserSpecification {
  readonly name = 'USER_CAN_MODERATE';
  readonly description = 'User can perform moderation actions';

  isSatisfiedBy(user: UserEntity): boolean {
    return user.role === UserRoles.admin || user.role === UserRoles.moderator;
  }
}

export class UserCanAdminSpecification extends BaseUserSpecification {
  readonly name = 'USER_CAN_ADMIN';
  readonly description = 'User can perform admin actions';

  isSatisfiedBy(user: UserEntity): boolean {
    return user.role === UserRoles.admin;
  }
}

/**
 * Business rule specifications
 */
export class UserCanChangeRoleSpecification extends BaseUserSpecification {
  readonly name = 'USER_CAN_CHANGE_ROLE';
  readonly description = 'User role change is allowed';

  constructor(
    private readonly newRole: UserRoles,
    private readonly performedBy: UserEntity,
  ) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    // Admin can change any role
    if (this.performedBy.role === UserRoles.admin) {
      return true;
    }

    // Moderators can only promote guests to moderator
    if (this.performedBy.role === UserRoles.moderator) {
      return (
        user.role === UserRoles.guest && this.newRole === UserRoles.moderator
      );
    }

    // Guests cannot change roles
    return false;
  }
}

export class UserAccountCanBeDeletedSpecification extends BaseUserSpecification {
  readonly name = 'USER_CAN_DELETE';
  readonly description = 'User account can be safely deleted';

  constructor(private readonly performedBy: UserEntity) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    // Users can delete their own account if not admin
    if (user.id === this.performedBy.id && user.role !== UserRoles.admin) {
      return true;
    }

    // Admins can delete non-admin accounts
    if (
      this.performedBy.role === UserRoles.admin &&
      user.role !== UserRoles.admin
    ) {
      return true;
    }

    // Prevent deletion of admin accounts by non-admins
    return false;
  }
}

/**
 * Password reset and security specifications
 */
export class UserCanResetPasswordSpecification extends BaseUserSpecification {
  readonly name = 'USER_CAN_RESET_PASSWORD';
  readonly description = 'User can reset their password';

  isSatisfiedBy(user: UserEntity): boolean {
    const userProps = user.getProps();

    // Must have email verified
    if (!user.isEmailVerified) {
      return false;
    }

    // Must not be locked
    if (user.isLocked) {
      return false;
    }

    // Check if reset token is valid and not expired
    if (userProps.passwordResetToken && userProps.passwordResetTokenExpiresAt) {
      return userProps.passwordResetTokenExpiresAt > new Date();
    }

    return true; // Can request password reset
  }
}

export class UserEmailVerificationValidSpecification extends BaseUserSpecification {
  readonly name = 'USER_EMAIL_VERIFICATION_VALID';
  readonly description = 'User email verification token is valid';

  constructor(private readonly providedToken: string) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    const userProps = user.getProps();

    // Must not already be verified
    if (user.isEmailVerified) {
      return false;
    }

    // Must have a verification token
    if (!userProps.emailVerificationToken) {
      return false;
    }

    // Token must match (use constant time comparison in real implementation)
    return userProps.emailVerificationToken === this.providedToken;
  }
}

/**
 * Composite specifications for common business scenarios
 */
export class ValidUserForLoginSpecification extends BaseUserSpecification {
  readonly name = 'VALID_USER_FOR_LOGIN';
  readonly description = 'User is valid for login attempt';

  private readonly specification: UserSpecification;

  constructor() {
    super();
    this.specification = new UserIsActiveSpecification()
      .and(new UserIsNotLockedSpecification())
      .and(new UserLoginAttemptsWithinLimitSpecification());
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return this.specification.isSatisfiedBy(user);
  }
}

export class FullyVerifiedUserSpecification extends BaseUserSpecification {
  readonly name = 'FULLY_VERIFIED_USER';
  readonly description = 'User is fully verified and can access all features';

  private readonly specification: UserSpecification;

  constructor() {
    super();
    this.specification = new UserIsActiveSpecification()
      .and(new UserIsEmailVerifiedSpecification())
      .and(new UserIsNotLockedSpecification())
      .and(new UserHasSecurePasswordSpecification());
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return this.specification.isSatisfiedBy(user);
  }
}

export class EligibleForRoleUpgradeSpecification extends BaseUserSpecification {
  readonly name = 'ELIGIBLE_FOR_ROLE_UPGRADE';
  readonly description = 'User is eligible for role upgrade';

  private readonly specification: UserSpecification;

  constructor() {
    super();
    this.specification = new FullyVerifiedUserSpecification().and(
      new UserLastLoginRecentSpecification(30),
    ); // Active within 30 days
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return (
      this.specification.isSatisfiedBy(user) && user.role === UserRoles.guest
    );
  }
}

/**
 * Factory class for creating common specification combinations
 */
export class UserSpecificationFactory {
  static canLogin(): UserSpecification {
    return new ValidUserForLoginSpecification();
  }

  static isFullyVerified(): UserSpecification {
    return new FullyVerifiedUserSpecification();
  }

  static canUpgradeRole(): UserSpecification {
    return new EligibleForRoleUpgradeSpecification();
  }

  static hasPermissionLevel(role: UserRoles): UserSpecification {
    switch (role) {
      case UserRoles.admin:
        return new UserCanAdminSpecification();
      case UserRoles.moderator:
        return new UserCanModerateSpecification();
      case UserRoles.guest:
        return new UserIsActiveSpecification();
      default:
        throw new Error(`Unknown role: ${role}`);
    }
  }

  static canPerformAction(
    action: 'delete' | 'changeRole' | 'resetPassword',
    context: {
      target?: UserEntity;
      performer?: UserEntity;
      newRole?: UserRoles;
    },
  ): UserSpecification {
    switch (action) {
      case 'delete':
        if (!context.target || !context.performer) {
          throw new Error('Target and performer required for delete action');
        }
        return new UserAccountCanBeDeletedSpecification(context.performer);

      case 'changeRole':
        if (!context.target || !context.performer || !context.newRole) {
          throw new Error(
            'Target, performer, and newRole required for changeRole action',
          );
        }
        return new UserCanChangeRoleSpecification(
          context.newRole,
          context.performer,
        );

      case 'resetPassword':
        return new UserCanResetPasswordSpecification();

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

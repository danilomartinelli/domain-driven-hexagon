import { DomainService } from '@libs/ddd';
import { UserEntity } from '../user.entity';
import { UserRoles } from '../user.types';
import {
  UserSpecificationFactory,
  UserCanChangeRoleSpecification,
  UserHasSecurePasswordSpecification,
  UserCanResetPasswordSpecification,
  UserEmailVerificationValidSpecification,
} from '../specifications/user.specifications';

/**
 * Domain service error for user operations
 */
export class UserDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'UserDomainError';
  }
}

/**
 * Result type for domain operations
 */
export interface DomainOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: UserDomainError;
  warnings?: string[];
}

/**
 * User domain service implementing rich business logic with specifications.
 *
 * This service encapsulates complex business rules and domain logic that
 * doesn't belong directly in the entity. It uses the Specification pattern
 * to ensure business rules are explicit, testable, and reusable.
 */
export class UserDomainService implements DomainService {
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly PASSWORD_RESET_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly EMAIL_VERIFICATION_TOKEN_EXPIRY_MS =
    24 * 60 * 60 * 1000; // 24 hours

  /**
   * Validate user login attempt and handle security policies
   */
  validateLoginAttempt(
    user: UserEntity,
  ): DomainOperationResult<{ canLogin: boolean; remainingAttempts: number }> {
    const canLoginSpec = UserSpecificationFactory.canLogin();

    if (!canLoginSpec.isSatisfiedBy(user)) {
      let reason = 'Login not allowed';
      let code = 'LOGIN_NOT_ALLOWED';

      if (!user.isActive) {
        reason = 'Account is deactivated';
        code = 'ACCOUNT_DEACTIVATED';
      } else if (user.isLocked) {
        reason = 'Account is locked due to too many failed login attempts';
        code = 'ACCOUNT_LOCKED';
      } else if (user.loginAttempts >= UserDomainService.MAX_LOGIN_ATTEMPTS) {
        reason = 'Too many login attempts';
        code = 'TOO_MANY_ATTEMPTS';
      }

      return {
        success: false,
        error: new UserDomainError(reason, code, {
          userId: user.id,
          loginAttempts: user.loginAttempts,
          isLocked: user.isLocked,
        }),
      };
    }

    const remainingAttempts = Math.max(
      0,
      UserDomainService.MAX_LOGIN_ATTEMPTS - user.loginAttempts,
    );

    return {
      success: true,
      data: {
        canLogin: true,
        remainingAttempts,
      },
    };
  }

  /**
   * Process successful login
   */
  processSuccessfulLogin(user: UserEntity): DomainOperationResult {
    try {
      // Reset login attempts on successful login
      user.resetLoginAttempts();

      // Update last login timestamp
      user.updateLastLogin();

      return {
        success: true,
        warnings: !user.isEmailVerified
          ? ['Email verification pending']
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to process successful login',
          'LOGIN_PROCESSING_ERROR',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Process failed login attempt with security policies
   */
  processFailedLogin(user: UserEntity): DomainOperationResult<{
    shouldLockAccount: boolean;
    remainingAttempts: number;
  }> {
    try {
      user.incrementLoginAttempts();

      const shouldLockAccount =
        user.loginAttempts >= UserDomainService.MAX_LOGIN_ATTEMPTS;
      const remainingAttempts = Math.max(
        0,
        UserDomainService.MAX_LOGIN_ATTEMPTS - user.loginAttempts,
      );

      if (shouldLockAccount) {
        user.lockAccount(UserDomainService.ACCOUNT_LOCK_DURATION_MS);
      }

      return {
        success: true,
        data: {
          shouldLockAccount,
          remainingAttempts,
        },
        warnings: shouldLockAccount
          ? ['Account has been locked due to failed login attempts']
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to process failed login',
          'FAILED_LOGIN_PROCESSING_ERROR',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Validate and process role change with business rules
   */
  changeUserRole(
    user: UserEntity,
    newRole: UserRoles,
    performedBy: UserEntity,
  ): DomainOperationResult {
    // Check if role change is allowed
    const canChangeRoleSpec = new UserCanChangeRoleSpecification(
      newRole,
      performedBy,
    );

    if (!canChangeRoleSpec.isSatisfiedBy(user)) {
      return {
        success: false,
        error: new UserDomainError(
          'Role change not allowed',
          'ROLE_CHANGE_NOT_ALLOWED',
          {
            userId: user.id,
            currentRole: user.role,
            newRole,
            performedBy: performedBy.id,
            performerRole: performedBy.role,
          },
        ),
      };
    }

    // Check if user is eligible for role upgrade (for guest -> moderator/admin)
    if (user.role === UserRoles.guest && newRole !== UserRoles.guest) {
      const eligibleSpec = UserSpecificationFactory.canUpgradeRole();

      if (!eligibleSpec.isSatisfiedBy(user)) {
        return {
          success: false,
          error: new UserDomainError(
            'User not eligible for role upgrade. Must be fully verified and recently active.',
            'NOT_ELIGIBLE_FOR_UPGRADE',
            {
              userId: user.id,
              isEmailVerified: user.isEmailVerified,
              hasSecurePassword:
                new UserHasSecurePasswordSpecification().isSatisfiedBy(user),
              lastLoginAt: user.lastLoginAt,
            },
          ),
        };
      }
    }

    try {
      // Perform role change based on new role
      switch (newRole) {
        case UserRoles.admin:
          user.makeAdmin();
          break;
        case UserRoles.moderator:
          user.makeModerator();
          break;
        case UserRoles.guest:
          // Note: In a real system, we might need a 'demote' method
          // For now, we'll handle this through the updateAuthProps method
          user.updateAuthProps({
            /* role would be updated through a different mechanism */
          });
          break;
        default:
          throw new Error(`Unknown role: ${newRole}`);
      }

      return {
        success: true,
        warnings:
          newRole === UserRoles.admin
            ? ['User granted admin privileges']
            : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to change user role',
          'ROLE_CHANGE_FAILED',
          {
            userId: user.id,
            newRole,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Initiate password reset process with security validation
   */
  initiatePasswordReset(
    user: UserEntity,
  ): DomainOperationResult<{ resetToken: string; expiresAt: Date }> {
    const canResetSpec = new UserCanResetPasswordSpecification();

    if (!canResetSpec.isSatisfiedBy(user)) {
      let reason = 'Password reset not allowed';
      let code = 'PASSWORD_RESET_NOT_ALLOWED';

      if (!user.isEmailVerified) {
        reason = 'Email must be verified before password reset';
        code = 'EMAIL_NOT_VERIFIED';
      } else if (user.isLocked) {
        reason = 'Account is locked';
        code = 'ACCOUNT_LOCKED';
      }

      return {
        success: false,
        error: new UserDomainError(reason, code, { userId: user.id }),
      };
    }

    try {
      // Generate secure reset token (in real implementation, use crypto.randomBytes)
      const resetToken = this.generateSecureToken();
      const expiresAt = new Date(
        Date.now() + UserDomainService.PASSWORD_RESET_TOKEN_EXPIRY_MS,
      );

      user.generatePasswordResetToken(resetToken, expiresAt);

      return {
        success: true,
        data: { resetToken, expiresAt },
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to initiate password reset',
          'PASSWORD_RESET_INITIATION_FAILED',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Complete password reset with validation
   */
  completePasswordReset(
    user: UserEntity,
    resetToken: string,
    newHashedPassword: string,
  ): DomainOperationResult {
    const userProps = user.getProps();

    // Validate reset token
    if (
      !userProps.passwordResetToken ||
      !userProps.passwordResetTokenExpiresAt
    ) {
      return {
        success: false,
        error: new UserDomainError(
          'No password reset token found',
          'NO_RESET_TOKEN',
          { userId: user.id },
        ),
      };
    }

    if (userProps.passwordResetToken !== resetToken) {
      return {
        success: false,
        error: new UserDomainError(
          'Invalid reset token',
          'INVALID_RESET_TOKEN',
          { userId: user.id },
        ),
      };
    }

    if (userProps.passwordResetTokenExpiresAt < new Date()) {
      return {
        success: false,
        error: new UserDomainError(
          'Reset token has expired',
          'RESET_TOKEN_EXPIRED',
          { userId: user.id, expiredAt: userProps.passwordResetTokenExpiresAt },
        ),
      };
    }

    try {
      // Update password and clear reset token
      user.updatePassword(newHashedPassword);

      // Reset login attempts as password was successfully changed
      user.resetLoginAttempts();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to complete password reset',
          'PASSWORD_RESET_COMPLETION_FAILED',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Initiate email verification process
   */
  initiateEmailVerification(
    user: UserEntity,
  ): DomainOperationResult<{ verificationToken: string }> {
    if (user.isEmailVerified) {
      return {
        success: false,
        error: new UserDomainError(
          'Email is already verified',
          'EMAIL_ALREADY_VERIFIED',
          { userId: user.id },
        ),
      };
    }

    try {
      const verificationToken = this.generateSecureToken();
      user.generateEmailVerificationToken(verificationToken);

      return {
        success: true,
        data: { verificationToken },
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to initiate email verification',
          'EMAIL_VERIFICATION_INITIATION_FAILED',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Complete email verification
   */
  completeEmailVerification(
    user: UserEntity,
    verificationToken: string,
  ): DomainOperationResult {
    const verificationSpec = new UserEmailVerificationValidSpecification(
      verificationToken,
    );

    if (!verificationSpec.isSatisfiedBy(user)) {
      return {
        success: false,
        error: new UserDomainError(
          'Email verification failed',
          'EMAIL_VERIFICATION_FAILED',
          {
            userId: user.id,
            alreadyVerified: user.isEmailVerified,
            hasToken: !!user.getProps().emailVerificationToken,
          },
        ),
      };
    }

    try {
      user.verifyEmail();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: new UserDomainError(
          'Failed to complete email verification',
          'EMAIL_VERIFICATION_COMPLETION_FAILED',
          {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
      };
    }
  }

  /**
   * Validate user account for deletion
   */
  validateAccountDeletion(
    user: UserEntity,
    performedBy: UserEntity,
  ): DomainOperationResult<{ warnings: string[] }> {
    const canDeleteSpec = UserSpecificationFactory.canPerformAction('delete', {
      target: user,
      performer: performedBy,
    });

    if (!canDeleteSpec.isSatisfiedBy(user)) {
      return {
        success: false,
        error: new UserDomainError(
          'Account deletion not allowed',
          'ACCOUNT_DELETION_NOT_ALLOWED',
          {
            userId: user.id,
            performedBy: performedBy.id,
            userRole: user.role,
            performerRole: performedBy.role,
          },
        ),
      };
    }

    const warnings: string[] = [];

    // Add warnings for admin account deletion
    if (user.role === UserRoles.admin) {
      warnings.push(
        'Deleting admin account will remove administrative privileges',
      );
    }

    // Add warning for recent activity
    if (
      user.lastLoginAt &&
      Date.now() - user.lastLoginAt.getTime() < 7 * 24 * 60 * 60 * 1000
    ) {
      warnings.push('User was active within the last 7 days');
    }

    return {
      success: true,
      data: { warnings },
      warnings,
    };
  }

  /**
   * Check if user meets security requirements for sensitive operations
   */
  validateSecurityRequirements(
    user: UserEntity,
  ): DomainOperationResult<{ securityScore: number; issues: string[] }> {
    // const fullyVerifiedSpec = UserSpecificationFactory.isFullyVerified();
    const hasSecurePasswordSpec = new UserHasSecurePasswordSpecification();

    const issues: string[] = [];
    let securityScore = 0;

    // Check email verification (25 points)
    if (user.isEmailVerified) {
      securityScore += 25;
    } else {
      issues.push('Email not verified');
    }

    // Check password security (35 points)
    if (hasSecurePasswordSpec.isSatisfiedBy(user)) {
      securityScore += 35;
    } else {
      issues.push('Password does not meet security requirements');
    }

    // Check account status (20 points)
    if (user.isActive && !user.isLocked) {
      securityScore += 20;
    } else {
      issues.push('Account is not active or is locked');
    }

    // Check recent activity (20 points)
    if (
      user.lastLoginAt &&
      Date.now() - user.lastLoginAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ) {
      securityScore += 20;
    } else {
      issues.push('No recent login activity');
    }

    return {
      success: true,
      data: {
        securityScore,
        issues,
      },
      warnings:
        securityScore < 80
          ? ['User does not meet all security requirements']
          : undefined,
    };
  }

  /**
   * Generate a secure token for various operations
   * In real implementation, use crypto.randomBytes or similar
   */
  private generateSecureToken(): string {
    // This is a simplified implementation - use proper crypto in production
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}

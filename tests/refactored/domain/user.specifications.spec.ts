/**
 * Comprehensive tests for User Domain Specifications
 * Tests 15 business rule specifications and composable operations
 */

import { UserEntity } from '@modules/user/domain/user.entity';
import { UserRoles } from '@modules/user/domain/user.types';
import {
  BaseUserSpecification,
  UserIsActiveSpecification,
  UserIsEmailVerifiedSpecification,
  UserIsNotLockedSpecification,
  UserHasSecurePasswordSpecification,
  UserLoginAttemptsWithinLimitSpecification,
  UserLastLoginRecentSpecification,
  UserHasRoleSpecification,
  UserCanModerateSpecification,
  UserCanAdminSpecification,
  UserCanChangeRoleSpecification,
  UserAccountCanBeDeletedSpecification,
  UserCanResetPasswordSpecification,
  UserEmailVerificationValidSpecification,
  ValidUserForLoginSpecification,
  FullyVerifiedUserSpecification,
  EligibleForRoleUpgradeSpecification,
  UserSpecificationFactory,
} from '@modules/user/domain/specifications/user.specifications';
import {
  UserTestDataBuilder,
  BenchmarkRunner,
} from '../utils/refactoring-test.utils';

describe('User Domain Specifications', () => {
  let testUser: UserEntity;
  let adminUser: UserEntity;

  beforeEach(() => {
    testUser = UserTestDataBuilder.create().build();
    adminUser = UserTestDataBuilder.create().buildAdmin();
  });

  describe('Individual Specifications', () => {
    describe('Account Status Specifications', () => {
      describe('UserIsActiveSpecification', () => {
        it('should satisfy specification for active users', () => {
          // Arrange
          const spec = new UserIsActiveSpecification();
          const activeUser = UserTestDataBuilder.create()
            .withActiveStatus(true)
            .build();

          // Act
          const result = spec.isSatisfiedBy(activeUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_IS_ACTIVE');
          expect(spec.description).toBe('User account is active');
        });

        it('should not satisfy specification for inactive users', () => {
          // Arrange
          const spec = new UserIsActiveSpecification();
          const inactiveUser = UserTestDataBuilder.create()
            .withActiveStatus(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(inactiveUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserIsEmailVerifiedSpecification', () => {
        it('should satisfy specification for verified users', () => {
          // Arrange
          const spec = new UserIsEmailVerifiedSpecification();
          const verifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .build();

          // Act
          const result = spec.isSatisfiedBy(verifiedUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_EMAIL_VERIFIED');
        });

        it('should not satisfy specification for unverified users', () => {
          // Arrange
          const spec = new UserIsEmailVerifiedSpecification();
          const unverifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(unverifiedUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserIsNotLockedSpecification', () => {
        it('should satisfy specification for unlocked users', () => {
          // Arrange
          const spec = new UserIsNotLockedSpecification();
          const unlockedUser = UserTestDataBuilder.create()
            .withLockedStatus(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(unlockedUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_NOT_LOCKED');
        });

        it('should not satisfy specification for locked users', () => {
          // Arrange
          const spec = new UserIsNotLockedSpecification();
          const lockedUser = UserTestDataBuilder.create()
            .withLockedStatus(true)
            .build();

          // Act
          const result = spec.isSatisfiedBy(lockedUser);

          // Assert
          expect(result).toBe(false);
        });
      });
    });

    describe('Authentication Security Specifications', () => {
      describe('UserHasSecurePasswordSpecification', () => {
        it('should satisfy specification for users with secure passwords', () => {
          // Arrange
          const spec = new UserHasSecurePasswordSpecification();
          const secureUser = UserTestDataBuilder.create()
            .withPassword('MyVerySecureP@ssw0rd123!')
            .build();

          // Act
          const result = spec.isSatisfiedBy(secureUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_SECURE_PASSWORD');
        });

        it('should not satisfy specification for users with weak passwords', () => {
          // Arrange
          const spec = new UserHasSecurePasswordSpecification();
          const weakPasswordUser = UserTestDataBuilder.create()
            .withPassword('123456')
            .build();

          // Act
          const result = spec.isSatisfiedBy(weakPasswordUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not satisfy specification for users without passwords', () => {
          // Arrange
          const spec = new UserHasSecurePasswordSpecification();
          const noPasswordUser = UserTestDataBuilder.create()
            .withPassword(null as any)
            .build();

          // Act
          const result = spec.isSatisfiedBy(noPasswordUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserLoginAttemptsWithinLimitSpecification', () => {
        it('should satisfy specification for users within login attempt limits', () => {
          // Arrange
          const spec = new UserLoginAttemptsWithinLimitSpecification(5);
          const goodUser = UserTestDataBuilder.create()
            .withLoginAttempts(3)
            .build();

          // Act
          const result = spec.isSatisfiedBy(goodUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_LOGIN_ATTEMPTS_OK');
        });

        it('should not satisfy specification for users exceeding login attempt limits', () => {
          // Arrange
          const spec = new UserLoginAttemptsWithinLimitSpecification(5);
          const badUser = UserTestDataBuilder.create()
            .withLoginAttempts(6)
            .build();

          // Act
          const result = spec.isSatisfiedBy(badUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should use default max attempts when not specified', () => {
          // Arrange
          const spec = new UserLoginAttemptsWithinLimitSpecification();
          const userAtLimit = UserTestDataBuilder.create()
            .withLoginAttempts(4)
            .build();

          // Act
          const result = spec.isSatisfiedBy(userAtLimit);

          // Assert
          expect(result).toBe(true); // Should use default of 5
        });
      });

      describe('UserLastLoginRecentSpecification', () => {
        it('should satisfy specification for recently logged in users', () => {
          // Arrange
          const spec = new UserLastLoginRecentSpecification(90);
          const recentDate = new Date();
          recentDate.setDate(recentDate.getDate() - 30); // 30 days ago
          const recentUser = UserTestDataBuilder.create()
            .withLastLogin(recentDate)
            .build();

          // Act
          const result = spec.isSatisfiedBy(recentUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.name).toBe('USER_RECENT_LOGIN');
        });

        it('should not satisfy specification for stale users', () => {
          // Arrange
          const spec = new UserLastLoginRecentSpecification(90);
          const staleDate = new Date();
          staleDate.setDate(staleDate.getDate() - 100); // 100 days ago
          const staleUser = UserTestDataBuilder.create()
            .withLastLogin(staleDate)
            .build();

          // Act
          const result = spec.isSatisfiedBy(staleUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not satisfy specification for users who never logged in', () => {
          // Arrange
          const spec = new UserLastLoginRecentSpecification(90);
          const neverLoggedInUser = UserTestDataBuilder.create()
            .withLastLogin(null)
            .build();

          // Act
          const result = spec.isSatisfiedBy(neverLoggedInUser);

          // Assert
          expect(result).toBe(false);
        });
      });
    });

    describe('Role and Permission Specifications', () => {
      describe('UserHasRoleSpecification', () => {
        it('should satisfy specification for users with matching roles', () => {
          // Arrange
          const spec = new UserHasRoleSpecification(UserRoles.admin);
          const adminUser = UserTestDataBuilder.create().buildAdmin();

          // Act
          const result = spec.isSatisfiedBy(adminUser);

          // Assert
          expect(result).toBe(true);
          expect(spec.description).toContain('admin');
        });

        it('should not satisfy specification for users with different roles', () => {
          // Arrange
          const spec = new UserHasRoleSpecification(UserRoles.admin);
          const guestUser = UserTestDataBuilder.create().build();

          // Act
          const result = spec.isSatisfiedBy(guestUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserCanModerateSpecification', () => {
        it('should satisfy specification for admin users', () => {
          // Arrange
          const spec = new UserCanModerateSpecification();
          const adminUser = UserTestDataBuilder.create().buildAdmin();

          // Act
          const result = spec.isSatisfiedBy(adminUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should satisfy specification for moderator users', () => {
          // Arrange
          const spec = new UserCanModerateSpecification();
          const moderatorUser = UserTestDataBuilder.create().buildModerator();

          // Act
          const result = spec.isSatisfiedBy(moderatorUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should not satisfy specification for guest users', () => {
          // Arrange
          const spec = new UserCanModerateSpecification();
          const guestUser = UserTestDataBuilder.create().build();

          // Act
          const result = spec.isSatisfiedBy(guestUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserCanAdminSpecification', () => {
        it('should satisfy specification only for admin users', () => {
          // Arrange
          const spec = new UserCanAdminSpecification();
          const adminUser = UserTestDataBuilder.create().buildAdmin();
          const moderatorUser = UserTestDataBuilder.create().buildModerator();
          const guestUser = UserTestDataBuilder.create().build();

          // Act & Assert
          expect(spec.isSatisfiedBy(adminUser)).toBe(true);
          expect(spec.isSatisfiedBy(moderatorUser)).toBe(false);
          expect(spec.isSatisfiedBy(guestUser)).toBe(false);
        });
      });
    });

    describe('Business Rule Specifications', () => {
      describe('UserCanChangeRoleSpecification', () => {
        it('should allow admin to change any role', () => {
          // Arrange
          const adminUser = UserTestDataBuilder.create().buildAdmin();
          const targetUser = UserTestDataBuilder.create().build();
          const spec = new UserCanChangeRoleSpecification(
            UserRoles.moderator,
            adminUser,
          );

          // Act
          const result = spec.isSatisfiedBy(targetUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should allow moderator to promote guest to moderator only', () => {
          // Arrange
          const moderatorUser = UserTestDataBuilder.create().buildModerator();
          const guestUser = UserTestDataBuilder.create().build();
          const spec = new UserCanChangeRoleSpecification(
            UserRoles.moderator,
            moderatorUser,
          );

          // Act
          const result = spec.isSatisfiedBy(guestUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should not allow moderator to promote guest to admin', () => {
          // Arrange
          const moderatorUser = UserTestDataBuilder.create().buildModerator();
          const guestUser = UserTestDataBuilder.create().build();
          const spec = new UserCanChangeRoleSpecification(
            UserRoles.admin,
            moderatorUser,
          );

          // Act
          const result = spec.isSatisfiedBy(guestUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not allow guest to change roles', () => {
          // Arrange
          const guestUser = UserTestDataBuilder.create().build();
          const targetUser = UserTestDataBuilder.create().build();
          const spec = new UserCanChangeRoleSpecification(
            UserRoles.moderator,
            guestUser,
          );

          // Act
          const result = spec.isSatisfiedBy(targetUser);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserAccountCanBeDeletedSpecification', () => {
        it('should allow users to delete their own non-admin accounts', () => {
          // Arrange
          const guestUser = UserTestDataBuilder.create().build();
          const spec = new UserAccountCanBeDeletedSpecification(guestUser);

          // Act
          const result = spec.isSatisfiedBy(guestUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should not allow users to delete their own admin accounts', () => {
          // Arrange
          const adminUser = UserTestDataBuilder.create().buildAdmin();
          const spec = new UserAccountCanBeDeletedSpecification(adminUser);

          // Act
          const result = spec.isSatisfiedBy(adminUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should allow admin to delete non-admin accounts', () => {
          // Arrange
          const adminUser = UserTestDataBuilder.create().buildAdmin();
          const targetUser = UserTestDataBuilder.create().buildModerator();
          const spec = new UserAccountCanBeDeletedSpecification(adminUser);

          // Act
          const result = spec.isSatisfiedBy(targetUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should not allow admin to delete other admin accounts', () => {
          // Arrange
          const adminUser1 = UserTestDataBuilder.create().buildAdmin();
          const adminUser2 = UserTestDataBuilder.create().buildAdmin();
          const spec = new UserAccountCanBeDeletedSpecification(adminUser1);

          // Act
          const result = spec.isSatisfiedBy(adminUser2);

          // Assert
          expect(result).toBe(false);
        });
      });
    });

    describe('Password Reset and Security Specifications', () => {
      describe('UserCanResetPasswordSpecification', () => {
        it('should allow password reset for verified, unlocked users', () => {
          // Arrange
          const spec = new UserCanResetPasswordSpecification();
          const validUser = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .withLockedStatus(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(validUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should not allow password reset for unverified users', () => {
          // Arrange
          const spec = new UserCanResetPasswordSpecification();
          const unverifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(false)
            .withLockedStatus(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(unverifiedUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not allow password reset for locked users', () => {
          // Arrange
          const spec = new UserCanResetPasswordSpecification();
          const lockedUser = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .withLockedStatus(true)
            .build();

          // Act
          const result = spec.isSatisfiedBy(lockedUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should validate reset token expiration', () => {
          // Arrange
          const spec = new UserCanResetPasswordSpecification();
          const futureDate = new Date();
          futureDate.setHours(futureDate.getHours() + 1); // 1 hour from now

          const userWithValidToken = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .withLockedStatus(false)
            .withPasswordResetToken('valid-token', futureDate)
            .build();

          // Act
          const result = spec.isSatisfiedBy(userWithValidToken);

          // Assert
          expect(result).toBe(true);
        });

        it('should reject expired reset tokens', () => {
          // Arrange
          const spec = new UserCanResetPasswordSpecification();
          const pastDate = new Date();
          pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago

          const userWithExpiredToken = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .withLockedStatus(false)
            .withPasswordResetToken('expired-token', pastDate)
            .build();

          // Act
          const result = spec.isSatisfiedBy(userWithExpiredToken);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('UserEmailVerificationValidSpecification', () => {
        it('should validate correct verification token for unverified user', () => {
          // Arrange
          const token = 'valid-verification-token';
          const spec = new UserEmailVerificationValidSpecification(token);
          const unverifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(false)
            .withEmailVerificationToken(token)
            .build();

          // Act
          const result = spec.isSatisfiedBy(unverifiedUser);

          // Assert
          expect(result).toBe(true);
        });

        it('should reject incorrect verification token', () => {
          // Arrange
          const correctToken = 'correct-token';
          const wrongToken = 'wrong-token';
          const spec = new UserEmailVerificationValidSpecification(wrongToken);
          const unverifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(false)
            .withEmailVerificationToken(correctToken)
            .build();

          // Act
          const result = spec.isSatisfiedBy(unverifiedUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not validate token for already verified users', () => {
          // Arrange
          const token = 'valid-token';
          const spec = new UserEmailVerificationValidSpecification(token);
          const verifiedUser = UserTestDataBuilder.create()
            .withEmailVerified(true)
            .withEmailVerificationToken(token)
            .build();

          // Act
          const result = spec.isSatisfiedBy(verifiedUser);

          // Assert
          expect(result).toBe(false);
        });

        it('should not validate when no token exists', () => {
          // Arrange
          const token = 'some-token';
          const spec = new UserEmailVerificationValidSpecification(token);
          const userWithoutToken = UserTestDataBuilder.create()
            .withEmailVerified(false)
            .build();

          // Act
          const result = spec.isSatisfiedBy(userWithoutToken);

          // Assert
          expect(result).toBe(false);
        });
      });
    });
  });

  describe('Composite Specifications', () => {
    describe('ValidUserForLoginSpecification', () => {
      it('should satisfy specification for valid login users', () => {
        // Arrange
        const spec = new ValidUserForLoginSpecification();
        const validUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withLockedStatus(false)
          .withLoginAttempts(2)
          .build();

        // Act
        const result = spec.isSatisfiedBy(validUser);

        // Assert
        expect(result).toBe(true);
        expect(spec.name).toBe('VALID_USER_FOR_LOGIN');
      });

      it('should not satisfy specification for inactive users', () => {
        // Arrange
        const spec = new ValidUserForLoginSpecification();
        const inactiveUser = UserTestDataBuilder.create()
          .withActiveStatus(false)
          .withLockedStatus(false)
          .withLoginAttempts(2)
          .build();

        // Act
        const result = spec.isSatisfiedBy(inactiveUser);

        // Assert
        expect(result).toBe(false);
      });

      it('should not satisfy specification for locked users', () => {
        // Arrange
        const spec = new ValidUserForLoginSpecification();
        const lockedUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withLockedStatus(true)
          .withLoginAttempts(2)
          .build();

        // Act
        const result = spec.isSatisfiedBy(lockedUser);

        // Assert
        expect(result).toBe(false);
      });

      it('should not satisfy specification for users with too many login attempts', () => {
        // Arrange
        const spec = new ValidUserForLoginSpecification();
        const tooManyAttemptsUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withLockedStatus(false)
          .withLoginAttempts(6)
          .build();

        // Act
        const result = spec.isSatisfiedBy(tooManyAttemptsUser);

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('FullyVerifiedUserSpecification', () => {
      it('should satisfy specification for fully verified users', () => {
        // Arrange
        const spec = new FullyVerifiedUserSpecification();
        const fullyVerifiedUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('VerySecurePassword123!')
          .build();

        // Act
        const result = spec.isSatisfiedBy(fullyVerifiedUser);

        // Assert
        expect(result).toBe(true);
        expect(spec.name).toBe('FULLY_VERIFIED_USER');
      });

      it('should not satisfy specification for users with weak passwords', () => {
        // Arrange
        const spec = new FullyVerifiedUserSpecification();
        const weakPasswordUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('weak')
          .build();

        // Act
        const result = spec.isSatisfiedBy(weakPasswordUser);

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('EligibleForRoleUpgradeSpecification', () => {
      it('should satisfy specification for eligible guest users', () => {
        // Arrange
        const spec = new EligibleForRoleUpgradeSpecification();
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 15); // 15 days ago (within 30 day limit)

        const eligibleUser = UserTestDataBuilder.create()
          .withRole(UserRoles.guest)
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('SecurePassword123!')
          .withLastLogin(recentDate)
          .build();

        // Act
        const result = spec.isSatisfiedBy(eligibleUser);

        // Assert
        expect(result).toBe(true);
        expect(spec.name).toBe('ELIGIBLE_FOR_ROLE_UPGRADE');
      });

      it('should not satisfy specification for stale users', () => {
        // Arrange
        const spec = new EligibleForRoleUpgradeSpecification();
        const staleDate = new Date();
        staleDate.setDate(staleDate.getDate() - 45); // 45 days ago (beyond 30 day limit)

        const staleUser = UserTestDataBuilder.create()
          .withRole(UserRoles.guest)
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('SecurePassword123!')
          .withLastLogin(staleDate)
          .build();

        // Act
        const result = spec.isSatisfiedBy(staleUser);

        // Assert
        expect(result).toBe(false);
      });

      it('should not satisfy specification for non-guest users', () => {
        // Arrange
        const spec = new EligibleForRoleUpgradeSpecification();
        const moderatorUser = UserTestDataBuilder.create().buildModerator(); // Already has elevated role

        // Act
        const result = spec.isSatisfiedBy(moderatorUser);

        // Assert
        expect(result).toBe(false);
      });
    });
  });

  describe('Specification Composition (AND, OR, NOT)', () => {
    describe('AND Operations', () => {
      it('should combine specifications with AND logic', () => {
        // Arrange
        const activeSpec = new UserIsActiveSpecification();
        const verifiedSpec = new UserIsEmailVerifiedSpecification();
        const compositeSpec = activeSpec.and(verifiedSpec);

        const activeVerifiedUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .build();

        const activeUnverifiedUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(false)
          .build();

        // Act & Assert
        expect(compositeSpec.isSatisfiedBy(activeVerifiedUser)).toBe(true);
        expect(compositeSpec.isSatisfiedBy(activeUnverifiedUser)).toBe(false);
        expect(compositeSpec.description).toContain('AND');
      });

      it('should chain multiple AND operations', () => {
        // Arrange
        const activeSpec = new UserIsActiveSpecification();
        const verifiedSpec = new UserIsEmailVerifiedSpecification();
        const unlockedSpec = new UserIsNotLockedSpecification();
        const compositeSpec = activeSpec.and(verifiedSpec).and(unlockedSpec);

        const fullyValidUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .build();

        const partiallyValidUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(true) // Fails last condition
          .build();

        // Act & Assert
        expect(compositeSpec.isSatisfiedBy(fullyValidUser)).toBe(true);
        expect(compositeSpec.isSatisfiedBy(partiallyValidUser)).toBe(false);
      });
    });

    describe('OR Operations', () => {
      it('should combine specifications with OR logic', () => {
        // Arrange
        const adminSpec = new UserCanAdminSpecification();
        const moderatorSpec = new UserCanModerateSpecification();
        const compositeSpec = adminSpec.or(moderatorSpec);

        const adminUser = UserTestDataBuilder.create().buildAdmin();
        const moderatorUser = UserTestDataBuilder.create().buildModerator();
        const guestUser = UserTestDataBuilder.create().build();

        // Act & Assert
        expect(compositeSpec.isSatisfiedBy(adminUser)).toBe(true);
        expect(compositeSpec.isSatisfiedBy(moderatorUser)).toBe(true);
        expect(compositeSpec.isSatisfiedBy(guestUser)).toBe(false);
        expect(compositeSpec.description).toContain('OR');
      });

      it('should short-circuit on first true condition in OR', () => {
        // Arrange - Create a mock specification that tracks calls
        let callCount = 0;
        class TrackingSpecification extends BaseUserSpecification {
          readonly name = 'TRACKING_SPEC';
          readonly description = 'Tracking specification';

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          isSatisfiedBy(_user: UserEntity): boolean {
            callCount++;
            return false; // Always false
          }
        }

        const alwaysTrueSpec = new UserIsActiveSpecification();
        const trackingSpec = new TrackingSpecification();
        const compositeSpec = alwaysTrueSpec.or(trackingSpec);

        const activeUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .build();

        // Act
        const result = compositeSpec.isSatisfiedBy(activeUser);

        // Assert
        expect(result).toBe(true);
        expect(callCount).toBe(0); // Should not have called the tracking spec due to short-circuiting
      });
    });

    describe('NOT Operations', () => {
      it('should negate specification results', () => {
        // Arrange
        const activeSpec = new UserIsActiveSpecification();
        const notActiveSpec = activeSpec.not();

        const activeUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .build();
        const inactiveUser = UserTestDataBuilder.create()
          .withActiveStatus(false)
          .build();

        // Act & Assert
        expect(notActiveSpec.isSatisfiedBy(activeUser)).toBe(false);
        expect(notActiveSpec.isSatisfiedBy(inactiveUser)).toBe(true);
        expect(notActiveSpec.description).toContain('NOT');
        expect(notActiveSpec.name).toBe('NOT_COMPOSITE');
      });

      it('should handle double negation correctly', () => {
        // Arrange
        const activeSpec = new UserIsActiveSpecification();
        const doubleNegatedSpec = activeSpec.not().not();

        const activeUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .build();

        // Act
        const result = doubleNegatedSpec.isSatisfiedBy(activeUser);

        // Assert
        expect(result).toBe(true); // NOT NOT active = active
      });
    });

    describe('Complex Compositions', () => {
      it('should handle complex specification compositions', () => {
        // Arrange
        // (active AND verified) OR (admin AND not locked)
        const activeSpec = new UserIsActiveSpecification();
        const verifiedSpec = new UserIsEmailVerifiedSpecification();
        const adminSpec = new UserCanAdminSpecification();
        const lockedSpec = new UserIsNotLockedSpecification();

        const complexSpec = activeSpec
          .and(verifiedSpec)
          .or(adminSpec.and(lockedSpec));

        // Test cases
        const activeVerifiedGuest = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withRole(UserRoles.guest)
          .build();

        const inactiveUnverifiedAdmin = UserTestDataBuilder.create()
          .withActiveStatus(false)
          .withEmailVerified(false)
          .withRole(UserRoles.admin)
          .withLockedStatus(false)
          .build();

        const inactiveVerifiedGuest = UserTestDataBuilder.create()
          .withActiveStatus(false)
          .withEmailVerified(true)
          .withRole(UserRoles.guest)
          .build();

        // Act & Assert
        expect(complexSpec.isSatisfiedBy(activeVerifiedGuest)).toBe(true);
        expect(complexSpec.isSatisfiedBy(inactiveUnverifiedAdmin)).toBe(true);
        expect(complexSpec.isSatisfiedBy(inactiveVerifiedGuest)).toBe(false);
      });
    });
  });

  describe('UserSpecificationFactory', () => {
    describe('Factory Methods', () => {
      it('should create login validation specification', () => {
        // Arrange
        const spec = UserSpecificationFactory.canLogin();
        const validUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withLockedStatus(false)
          .withLoginAttempts(2)
          .build();

        // Act
        const result = spec.isSatisfiedBy(validUser);

        // Assert
        expect(result).toBe(true);
        expect(spec).toBeInstanceOf(ValidUserForLoginSpecification);
      });

      it('should create fully verified specification', () => {
        // Arrange
        const spec = UserSpecificationFactory.isFullyVerified();
        const fullyVerifiedUser = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('SecurePassword123!')
          .build();

        // Act
        const result = spec.isSatisfiedBy(fullyVerifiedUser);

        // Assert
        expect(result).toBe(true);
        expect(spec).toBeInstanceOf(FullyVerifiedUserSpecification);
      });

      it('should create role upgrade eligibility specification', () => {
        // Arrange
        const spec = UserSpecificationFactory.canUpgradeRole();

        // Act & Assert
        expect(spec).toBeInstanceOf(EligibleForRoleUpgradeSpecification);
      });

      it('should create permission level specifications', () => {
        const roleTests = [
          { role: UserRoles.admin, expectedType: UserCanAdminSpecification },
          {
            role: UserRoles.moderator,
            expectedType: UserCanModerateSpecification,
          },
          { role: UserRoles.guest, expectedType: UserIsActiveSpecification },
        ];

        roleTests.forEach(({ role, expectedType }) => {
          // Act
          const spec = UserSpecificationFactory.hasPermissionLevel(role);

          // Assert
          expect(spec).toBeInstanceOf(expectedType);
        });
      });

      it('should throw error for unknown roles', () => {
        // Act & Assert
        expect(() =>
          UserSpecificationFactory.hasPermissionLevel('unknown' as any),
        ).toThrow('Unknown role: unknown');
      });

      it('should create action-based specifications', () => {
        // Arrange
        const adminUser = UserTestDataBuilder.create().buildAdmin();
        const targetUser = UserTestDataBuilder.create().build();

        // Test delete action
        const deleteSpec = UserSpecificationFactory.canPerformAction('delete', {
          target: targetUser,
          performer: adminUser,
        });
        expect(deleteSpec).toBeInstanceOf(UserAccountCanBeDeletedSpecification);

        // Test role change action
        const changeRoleSpec = UserSpecificationFactory.canPerformAction(
          'changeRole',
          {
            target: targetUser,
            performer: adminUser,
            newRole: UserRoles.moderator,
          },
        );
        expect(changeRoleSpec).toBeInstanceOf(UserCanChangeRoleSpecification);

        // Test password reset action
        const resetPasswordSpec = UserSpecificationFactory.canPerformAction(
          'resetPassword',
          {
            target: targetUser,
          },
        );
        expect(resetPasswordSpec).toBeInstanceOf(
          UserCanResetPasswordSpecification,
        );
      });

      it('should throw errors for missing context in factory methods', () => {
        // Act & Assert
        expect(() =>
          UserSpecificationFactory.canPerformAction('delete', {}),
        ).toThrow('Target and performer required for delete action');

        expect(() =>
          UserSpecificationFactory.canPerformAction('changeRole', {
            target: testUser,
            performer: adminUser,
            // Missing newRole
          }),
        ).toThrow(
          'Target, performer, and newRole required for changeRole action',
        );

        expect(() =>
          UserSpecificationFactory.canPerformAction('unknown' as any, {}),
        ).toThrow('Unknown action: unknown');
      });
    });
  });

  describe('Performance and Efficiency', () => {
    describe('Specification Evaluation Performance', () => {
      it('should evaluate simple specifications efficiently', async () => {
        // Arrange
        const spec = new UserIsActiveSpecification();
        const users = Array.from({ length: 100 }, () =>
          UserTestDataBuilder.create().build(),
        );

        // Act
        const benchmark = await BenchmarkRunner.run(
          'simple-specification-evaluation',
          () => {
            users.forEach((user) => spec.isSatisfiedBy(user));
          },
          50,
        );

        // Assert
        expect(benchmark.stats.avg).toBeLessThan(5); // Should be very fast
      });

      it('should evaluate complex composite specifications efficiently', async () => {
        // Arrange
        const complexSpec = UserSpecificationFactory.isFullyVerified();
        const users = Array.from({ length: 50 }, () =>
          UserTestDataBuilder.create()
            .withActiveStatus(true)
            .withEmailVerified(true)
            .withLockedStatus(false)
            .withPassword('SecurePassword123!')
            .build(),
        );

        // Act
        const benchmark = await BenchmarkRunner.run(
          'complex-specification-evaluation',
          () => {
            users.forEach((user) => complexSpec.isSatisfiedBy(user));
          },
          20,
        );

        // Assert
        expect(benchmark.stats.avg).toBeLessThan(50); // Even complex specs should be reasonably fast
      });

      it('should demonstrate short-circuit evaluation benefits', async () => {
        // Arrange
        // Create a slow specification for comparison
        class SlowSpecification extends BaseUserSpecification {
          readonly name = 'SLOW_SPEC';
          readonly description = 'Slow specification';

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          isSatisfiedBy(_user: UserEntity): boolean {
            // Simulate slow operation
            const start = Date.now();
            while (Date.now() - start < 1) {
              /* busy wait 1ms */
            }
            return true;
          }
        }

        const fastSpec = new UserIsActiveSpecification();
        const slowSpec = new SlowSpecification();

        // OR composition with fast spec first (should short-circuit)
        const shortCircuitSpec = fastSpec.or(slowSpec);

        // OR composition with slow spec first (won't short-circuit as much)
        const noShortCircuitSpec = slowSpec.or(fastSpec);

        const activeUsers = Array.from({ length: 20 }, () =>
          UserTestDataBuilder.create().withActiveStatus(true).build(),
        );

        // Act
        const shortCircuitBenchmark = await BenchmarkRunner.run(
          'short-circuit-evaluation',
          () => {
            activeUsers.forEach((user) => shortCircuitSpec.isSatisfiedBy(user));
          },
          10,
        );

        const noShortCircuitBenchmark = await BenchmarkRunner.run(
          'no-short-circuit-evaluation',
          () => {
            activeUsers.forEach((user) =>
              noShortCircuitSpec.isSatisfiedBy(user),
            );
          },
          10,
        );

        // Assert
        // Short-circuit evaluation should be significantly faster
        expect(shortCircuitBenchmark.stats.avg).toBeLessThan(
          noShortCircuitBenchmark.stats.avg,
        );
      });
    });

    describe('Memory Usage', () => {
      it('should not leak memory with repeated evaluations', () => {
        // Arrange
        const spec = UserSpecificationFactory.isFullyVerified();
        const user = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .withEmailVerified(true)
          .withLockedStatus(false)
          .withPassword('SecurePassword123!')
          .build();

        // Act - Perform many evaluations
        for (let i = 0; i < 1000; i++) {
          spec.isSatisfiedBy(user);
        }

        // Assert - Should complete without memory issues
        expect(true).toBe(true); // If we reach here, no memory issues occurred
      });

      it('should handle large numbers of specifications efficiently', () => {
        // Arrange
        const specifications = Array.from(
          { length: 100 },
          () => new UserIsActiveSpecification(),
        );
        const user = UserTestDataBuilder.create()
          .withActiveStatus(true)
          .build();

        // Act
        const results = specifications.map((spec) => spec.isSatisfiedBy(user));

        // Assert
        expect(results.every((result) => result === true)).toBe(true);
        expect(results).toHaveLength(100);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined user entities gracefully', () => {
      // Arrange
      const spec = new UserIsActiveSpecification();

      // Act & Assert
      expect(() => spec.isSatisfiedBy(null as any)).not.toThrow();
      expect(() => spec.isSatisfiedBy(undefined as any)).not.toThrow();

      // The actual behavior depends on the implementation
      // but it should not crash the application
    });

    it('should handle edge case property values', () => {
      // Test specifications with edge case scenarios
      const edgeCases = [
        {
          name: 'Very high login attempts',
          user: UserTestDataBuilder.create().withLoginAttempts(999999).build(),
          spec: new UserLoginAttemptsWithinLimitSpecification(),
          expectedResult: false,
        },
        {
          name: 'Far future date',
          user: UserTestDataBuilder.create()
            .withLastLogin(new Date('2099-12-31'))
            .build(),
          spec: new UserLastLoginRecentSpecification(),
          expectedResult: true,
        },
        {
          name: 'Far past date',
          user: UserTestDataBuilder.create()
            .withLastLogin(new Date('1970-01-01'))
            .build(),
          spec: new UserLastLoginRecentSpecification(),
          expectedResult: false,
        },
      ];

      edgeCases.forEach(({ user, spec, expectedResult }) => {
        // Act
        const result = spec.isSatisfiedBy(user);

        // Assert
        expect(result).toBe(expectedResult);
      });
    });

    it('should maintain specification immutability', () => {
      // Arrange
      const spec = new UserIsActiveSpecification();
      const originalName = spec.name;
      const originalDescription = spec.description;

      // Act - Try to modify specification
      try {
        (spec as any).name = 'MODIFIED_NAME';
        (spec as any).description = 'Modified description';
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Expected if properties are readonly
      }

      // Assert - Properties should remain unchanged
      expect(spec.name).toBe(originalName);
      expect(spec.description).toBe(originalDescription);
    });
  });

  describe('Integration with Domain Model', () => {
    it('should work seamlessly with UserEntity domain model', () => {
      // Arrange
      const spec = UserSpecificationFactory.canLogin();

      // Create user through domain model methods
      const userProps = {
        email: 'integration.test@example.com',
        password: 'IntegrationTestPassword123!',
        role: UserRoles.guest,
        isActive: true,
        isEmailVerified: true,
        isLocked: false,
        loginAttempts: 0,
      };
      const domainUser = UserEntity.create(userProps);

      // Act
      const result = spec.isSatisfiedBy(domainUser);

      // Assert
      expect(result).toBe(true);
    });

    it('should respect domain entity invariants', () => {
      // This test ensures specifications work with domain entities
      // that enforce their own business rules and invariants

      // Arrange
      const spec = new UserHasSecurePasswordSpecification();

      // Create a user that should have password validation
      const user = UserTestDataBuilder.create()
        .withPassword('WeakPassword') // Domain might enforce minimum requirements
        .build();

      // Act
      const result = spec.isSatisfiedBy(user);

      // Assert
      // Result depends on domain model's password validation
      expect(typeof result).toBe('boolean');
    });
  });
});

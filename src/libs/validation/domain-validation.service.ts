import { Guard } from '@libs/guard';
import { Injectable } from '@nestjs/common';

/**
 * Centralized domain validation service providing reusable validation patterns
 * Follows DRY principle and SOLID design patterns
 */
@Injectable()
export class DomainValidationService {
  /**
   * Validates authentication-related fields with consistent business rules
   */
  validateAuthenticationFields(props: {
    loginAttempts?: number;
    isActive?: boolean;
    isEmailVerified?: boolean;
  }): void {
    if (props.loginAttempts !== undefined) {
      if (!Guard.isNonNegativeNumber(props.loginAttempts)) {
        throw new Error('Login attempts must be a non-negative number');
      }
      if (props.loginAttempts > 100) {
        throw new Error('Login attempts exceeded maximum limit');
      }
    }

    if (props.isActive !== undefined && typeof props.isActive !== 'boolean') {
      throw new Error('Active status must be a boolean value');
    }

    if (
      props.isEmailVerified !== undefined &&
      typeof props.isEmailVerified !== 'boolean'
    ) {
      throw new Error('Email verified status must be a boolean value');
    }
  }

  /**
   * Validates entity address requirements with type safety
   */
  validateAddressRequirements(address: unknown): void {
    if (!address) {
      throw new Error('Address is required');
    }

    if (!address.country || !address.street || !address.postalCode) {
      throw new Error(
        'Address must have all required fields: country, street, and postalCode',
      );
    }
  }

  /**
   * Validates email format with comprehensive rules
   */
  validateEmailFormat(email: string): void {
    if (!Guard.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Additional business rules
    if (email.length > 254) {
      throw new Error('Email address is too long');
    }

    if (email.length < 5) {
      throw new Error('Email address is too short');
    }
  }

  /**
   * Validates user role transitions with business logic
   */
  validateRoleTransition(currentRole: string, newRole: string): void {
    const validRoles = ['guest', 'user', 'moderator', 'admin'];

    if (!validRoles.includes(currentRole)) {
      throw new Error(`Invalid current role: ${currentRole}`);
    }

    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid new role: ${newRole}`);
    }

    // Business rule: guests cannot directly become admin
    if (currentRole === 'guest' && newRole === 'admin') {
      throw new Error('Guests cannot be directly promoted to admin role');
    }
  }

  /**
   * Validates lock expiration cleanup requirements
   */
  validateLockExpiration(lockedUntil?: Date): boolean {
    if (!lockedUntil) {
      return false;
    }

    const now = new Date();
    return lockedUntil <= now;
  }
}

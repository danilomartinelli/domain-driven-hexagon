import { Address } from './value-objects/address.value-object';

// All properties that a User has
export interface UserProps {
  role: UserRoles;
  email: string;
  address: Address;
  // Authentication fields
  password?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
}

// Properties that are needed for a user creation
export interface CreateUserProps {
  email: string;
  address: Address;
}

// Properties that are needed for user creation with authentication
export interface CreateUserAuthProps {
  email: string;
  address: Address;
  password: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  emailVerificationToken?: string;
  loginAttempts?: number;
}

// Properties used for updating a user address
export interface UpdateUserAddressProps {
  country?: string;
  postalCode?: string;
  street?: string;
}

// Properties used for updating user authentication fields
export interface UpdateUserAuthProps {
  password?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  loginAttempts?: number;
  lockedUntil?: Date;
}

export enum UserRoles {
  admin = 'admin',
  moderator = 'moderator',
  guest = 'guest',
}

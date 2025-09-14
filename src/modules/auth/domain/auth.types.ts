export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
  tokenType: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RefreshTokenProps {
  token: string;
  userId: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedByIp?: string;
  replacedByToken?: string;
  createdByIp?: string;
  userAgent?: string;
}

export interface CreateRefreshTokenProps {
  token: string;
  userId: string;
  expiresAt: Date;
  createdByIp?: string;
  userAgent?: string;
}

export interface RoleProps {
  name: string;
  description?: string;
  isActive: boolean;
  permissions: string[]; // Permission IDs
}

export interface CreateRoleProps {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface PermissionProps {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface CreatePermissionProps {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface AuthAuditLogProps {
  userId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

export interface CreateAuthAuditLogProps {
  userId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

// Authentication request interfaces
export interface LoginRequest {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  address: {
    country: string;
    postalCode: string;
    street: string;
  };
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

// User authentication properties
export interface UserAuthProps {
  password?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  roles: string[]; // Role IDs
}

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

// Security constants
export const AUTH_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_DURATION_MINUTES: 30,
  ACCESS_TOKEN_EXPIRES_IN_MINUTES: 15,
  REFRESH_TOKEN_EXPIRES_IN_DAYS: 7,
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRES_IN_HOURS: 1,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
} as const;

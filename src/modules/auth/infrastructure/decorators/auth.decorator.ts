import { SetMetadata } from '@nestjs/common';

export const AUTH_METADATA_KEY = 'auth';
export const ROLES_METADATA_KEY = 'roles';
export const PERMISSIONS_METADATA_KEY = 'permissions';

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  requireAll?: boolean; // If true, user must have ALL specified roles/permissions. If false, ANY will suffice.
}

/**
 * Mark a route as requiring authentication
 * @param options Authentication options
 */
export const Auth = (
  options: AuthOptions = { required: true },
): MethodDecorator => {
  return SetMetadata(AUTH_METADATA_KEY, options);
};

/**
 * Require specific roles for accessing a route
 * @param roles Array of role names required
 * @param requireAll Whether user must have ALL roles (default: false, meaning ANY role is sufficient)
 */
export const RequireRoles = (
  roles: string[],
  requireAll = false,
): MethodDecorator => {
  return SetMetadata(ROLES_METADATA_KEY, { roles, requireAll });
};

/**
 * Require specific permissions for accessing a route
 * @param permissions Array of permission names required (format: "resource:action")
 * @param requireAll Whether user must have ALL permissions (default: false, meaning ANY permission is sufficient)
 */
export const RequirePermissions = (
  permissions: string[],
  requireAll = false,
): MethodDecorator => {
  return SetMetadata(PERMISSIONS_METADATA_KEY, { permissions, requireAll });
};

/**
 * Mark a route as public (no authentication required)
 */
export const Public = (): MethodDecorator => {
  return SetMetadata(AUTH_METADATA_KEY, { required: false });
};

/**
 * Convenience decorator for admin-only routes
 */
export const AdminOnly = (): MethodDecorator => {
  return RequireRoles(['admin']);
};

/**
 * Convenience decorator for authenticated users only
 */
export const AuthenticatedOnly = (): MethodDecorator => {
  return Auth({ required: true });
};

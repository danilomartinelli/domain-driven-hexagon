import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../domain/auth.types';

export interface AuthenticatedUser extends JwtPayload {
  id: string; // Alias for 'sub' for convenience
}

/**
 * Extract the current authenticated user from the request
 * Usage: @CurrentUser() user: AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    
    if (!user) {
      return null;
    }

    // Add id alias for sub for convenience
    const enrichedUser: AuthenticatedUser = {
      ...user,
      id: user.sub,
    };

    return data ? enrichedUser[data] : enrichedUser;
  },
);

/**
 * Extract only the user ID from the request
 * Usage: @UserId() userId: string
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    
    return user?.sub || null;
  },
);

/**
 * Extract user roles from the request
 * Usage: @UserRoles() roles: string[]
 */
export const UserRoles = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string[] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    
    return user?.roles || [];
  },
);

/**
 * Extract user permissions from the request  
 * Usage: @UserPermissions() permissions: string[]
 */
export const UserPermissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string[] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    
    return user?.permissions || [];
  },
);
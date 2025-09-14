import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtPayload } from '../../domain/auth.types';

/**
 * Guard to ensure users can only access their own resources
 * Checks if the authenticated user's ID matches the resource owner ID
 */
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get resource ID from route parameters
    const resourceId = request.params.id || request.params.userId;

    if (!resourceId) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    // Check if user is admin (admins can access any resource)
    if (user.roles && user.roles.includes('admin')) {
      return true;
    }

    // Check if user is accessing their own resource
    if (user.sub !== resourceId) {
      throw new ForbiddenException(
        'Access denied. You can only access your own resources',
      );
    }

    return true;
  }
}

/**
 * Factory function to create resource owner guard for specific parameter names
 */
export const createResourceOwnerGuard = (
  paramName: string,
): new () => CanActivate => {
  @Injectable()
  class DynamicResourceOwnerGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const user = request.user as JwtPayload;

      if (!user) {
        throw new ForbiddenException('User not authenticated');
      }

      // Get resource ID from specified parameter
      const resourceId = request.params[paramName];

      if (!resourceId) {
        throw new ForbiddenException(
          `Resource ID not found in parameter: ${paramName}`,
        );
      }

      // Check if user is admin (admins can access any resource)
      if (user.roles && user.roles.includes('admin')) {
        return true;
      }

      // Check if user is accessing their own resource
      if (user.sub !== resourceId) {
        throw new ForbiddenException(
          'Access denied. You can only access your own resources',
        );
      }

      return true;
    }
  }

  return DynamicResourceOwnerGuard;
};

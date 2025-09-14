import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA_KEY } from '../decorators/auth.decorator';
import { JwtPayload } from '../../domain/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from metadata
    const permissionsConfig = this.reflector.getAllAndOverride<{
      permissions: string[];
      requireAll: boolean;
    }>(PERMISSIONS_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (
      !permissionsConfig ||
      !permissionsConfig.permissions ||
      permissionsConfig.permissions.length === 0
    ) {
      return true; // No permission requirements
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions = user.permissions || [];
    const requiredPermissions = permissionsConfig.permissions;
    const requireAll = permissionsConfig.requireAll || false;

    if (requireAll) {
      // User must have ALL required permissions
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );
      if (!hasAllPermissions) {
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        );
      }
    } else {
      // User must have at least ONE of the required permissions
      const hasAnyPermission = requiredPermissions.some((permission) =>
        userPermissions.includes(permission),
      );
      if (!hasAnyPermission) {
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(' OR ')}`,
        );
      }
    }

    return true;
  }
}

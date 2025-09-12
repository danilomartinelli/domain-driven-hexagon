import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_METADATA_KEY } from '../decorators/auth.decorator';
import { JwtPayload } from '../../domain/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from metadata
    const rolesConfig = this.reflector.getAllAndOverride<{ roles: string[]; requireAll: boolean }>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesConfig || !rolesConfig.roles || rolesConfig.roles.length === 0) {
      return true; // No role requirements
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRoles = user.roles || [];
    const requiredRoles = rolesConfig.roles;
    const requireAll = rolesConfig.requireAll || false;

    if (requireAll) {
      // User must have ALL required roles
      const hasAllRoles = requiredRoles.every(role => userRoles.includes(role));
      if (!hasAllRoles) {
        throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
      }
    } else {
      // User must have at least ONE of the required roles
      const hasAnyRole = requiredRoles.some(role => userRoles.includes(role));
      if (!hasAnyRole) {
        throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(' OR ')}`);
      }
    }

    return true;
  }
}
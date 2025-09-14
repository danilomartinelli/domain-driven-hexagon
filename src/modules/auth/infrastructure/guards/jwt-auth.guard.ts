import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AUTH_METADATA_KEY, AuthOptions } from '../decorators/auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Check if the route is marked as public or has specific auth requirements
    const authOptions = this.reflector.getAllAndOverride<AuthOptions>(
      AUTH_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If auth is explicitly not required, allow access
    if (authOptions && !authOptions.required) {
      return true;
    }

    // Otherwise, proceed with JWT authentication
    return super.canActivate(context);
  }

  handleRequest(
    err: unknown,
    user: unknown,
    info: unknown,
    context: ExecutionContext,
  ): unknown {
    // Check if authentication is required
    const authOptions = this.reflector.getAllAndOverride<AuthOptions>(
      AUTH_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If auth is not required and no user is present, that's fine
    if (authOptions && !authOptions.required && !user) {
      return null;
    }

    // If there's an error or no user when auth is required, throw exception
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}

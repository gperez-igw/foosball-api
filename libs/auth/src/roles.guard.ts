import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import type { JwtPayload } from './token.service.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ADMIN_REQUIRED',
        message: 'This action requires admin privileges',
      });
    }

    if (requiredRoles.includes('admin') && !user.is_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ADMIN_REQUIRED',
        message: 'This action requires admin privileges',
      });
    }

    return true;
  }
}

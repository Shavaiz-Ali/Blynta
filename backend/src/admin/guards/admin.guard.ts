import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || user.role !== UserRole.ADMIN || user.sessionKind !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}

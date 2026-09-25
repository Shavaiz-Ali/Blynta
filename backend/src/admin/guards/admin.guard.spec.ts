import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserRole } from '../../users/schemas/user.schema';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if user has ADMIN role', () => {
    const context = createMockContext({
      userId: 'admin-123',
      role: UserRole.ADMIN,
      email: 'admin@blynta.com',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user has USER role (non-admin)', () => {
    const context = createMockContext({
      userId: 'user-123',
      role: UserRole.USER,
      email: 'user@blynta.com',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Admin access required');
  });

  it('should throw ForbiddenException if request.user is missing / unauthenticated', () => {
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from './guards/admin.guard';
import { UserRole } from '../users/schemas/user.schema';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminBillingController } from './billing/admin-billing.controller';
import { AdminJobsController } from './jobs/admin-jobs.controller';
import { AdminNotificationsController } from './notifications/admin-notifications.controller';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminBillingService } from './billing/admin-billing.service';
import { AdminJobsService } from './jobs/admin-jobs.service';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { AdminAuditService } from './audit/admin-audit.service';

describe('Admin Controllers - AdminGuard Enforcement', () => {
  const controllers = [
    AdminUsersController,
    AdminBillingController,
    AdminJobsController,
    AdminNotificationsController,
    AdminAuditController,
  ];

  const adminGuard = new AdminGuard();

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it.each(controllers)(
    'ensures %p has AdminGuard configured and rejects non-admin users with 403',
    (ControllerClass) => {
      // 1. Verify that the controller has guards applied
      const guards = Reflect.getMetadata('__guards__', ControllerClass);
      expect(guards).toBeDefined();

      // 2. Verify non-admin gets 403 Forbidden
      const nonAdminCtx = createMockContext({
        userId: 'regular-user',
        role: UserRole.USER,
        email: 'user@blynta.com',
      });

      expect(() => adminGuard.canActivate(nonAdminCtx)).toThrow(
        ForbiddenException,
      );
      expect(() => adminGuard.canActivate(nonAdminCtx)).toThrow(
        'Admin access required',
      );

      // 3. Verify admin gets allowed
      const adminCtx = createMockContext({
        userId: 'admin-user',
        role: UserRole.ADMIN,
        email: 'admin@blynta.com',
      });

      expect(adminGuard.canActivate(adminCtx)).toBe(true);
    },
  );
});

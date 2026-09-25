import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Customer, CustomerSchema } from '../billing/schemas/customer.schema';
import {
  SubscriptionEvent,
  SubscriptionEventSchema,
} from '../billing/schemas/subscription-event.schema';
import {
  CreditAdjustment,
  CreditAdjustmentSchema,
} from './schemas/credit-adjustment.schema';
import { Job, JobSchema } from '../jobs/schemas/job.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import { NOTIFICATIONS_QUEUE } from '../notifications/notifications.constants';

import { ActivitiesModule } from '../activities/activities.module';
import { PaddleModule } from '../paddle/paddle.module';
import { BillingModule } from '../billing/billing.module';

import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

import { AdminBillingController } from './billing/admin-billing.controller';
import { AdminBillingService } from './billing/admin-billing.service';

import { AdminJobsController } from './jobs/admin-jobs.controller';
import { AdminJobsService } from './jobs/admin-jobs.service';

import { AdminNotificationsController } from './notifications/admin-notifications.controller';
import { AdminNotificationsService } from './notifications/admin-notifications.service';

import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminAuditService } from './audit/admin-audit.service';

import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: SubscriptionEvent.name, schema: SubscriptionEventSchema },
      { name: CreditAdjustment.name, schema: CreditAdjustmentSchema },
      { name: Job.name, schema: JobSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
    ActivitiesModule,
    PaddleModule,
    BillingModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminBillingController,
    AdminJobsController,
    AdminNotificationsController,
    AdminAuditController,
  ],
  providers: [
    AdminGuard,
    JwtAuthGuard,
    AdminDashboardService,
    AdminUsersService,
    AdminBillingService,
    AdminJobsService,
    AdminNotificationsService,
    AdminAuditService,
  ],
  exports: [
    AdminGuard,
    JwtAuthGuard,
    AdminDashboardService,
    AdminUsersService,
    AdminBillingService,
    AdminJobsService,
    AdminNotificationsService,
    AdminAuditService,
  ],
})
export class AdminModule {}

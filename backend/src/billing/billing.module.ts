import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import {
  ProcessedPaddleEvent,
  ProcessedPaddleEventSchema,
} from './schemas/processed-paddle-event.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import {
  SubscriptionEvent,
  SubscriptionEventSchema,
} from './schemas/subscription-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: SubscriptionEvent.name, schema: SubscriptionEventSchema },
      { name: ProcessedPaddleEvent.name, schema: ProcessedPaddleEventSchema },
    ]),
    UsersModule,
    MailModule,
    NotificationsModule,
    ActivitiesModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

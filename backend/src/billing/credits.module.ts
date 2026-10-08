import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  CreditEntrySchema,
  CreditOperationSchema,
  ProcessingUsageSchema,
} from './credit.schemas';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { BillingRateLimitGuard } from './billing-rate-limit.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    RedisModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: 'CreditEntry', schema: CreditEntrySchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: 'CreditOperation', schema: CreditOperationSchema },
      { name: 'ProcessingUsage', schema: ProcessingUsageSchema },
    ]),
  ],
  providers: [CreditsService, BillingRateLimitGuard],
  controllers: [CreditsController],
  exports: [CreditsService, BillingRateLimitGuard, MongooseModule],
})
export class CreditsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { MailModule } from 'src/mail/mail.module';
import { ReferralReward, ReferralRewardSchema } from './schemas/referral-reward.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema },
  { name: ReferralReward.name, schema: ReferralRewardSchema }
  ],

  ),
    MailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],

})
export class UsersModule { }
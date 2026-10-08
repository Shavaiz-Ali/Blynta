import { CreditsModule } from '../billing/credits.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { RenderCapacityService } from './render-capacity.service';
import { RenderEtaService } from './render-eta.service';
import { Job, JobSchema } from './schemas/job.schema';
import { JOBS_QUEUE, RENDER_QUEUE } from './jobs.constants';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { ActivitiesModule } from '../activities/activities.module';
import { StudioAssetSchema } from '../studio/studio.schemas';

@Module({
  imports: [
    CreditsModule,
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: 'StudioAsset', schema: StudioAssetSchema },
    ]),
    BullModule.registerQueue({ name: JOBS_QUEUE }, { name: RENDER_QUEUE }),
    UsersModule,
    MediaModule,
    StorageModule,
    NotificationsModule,
    MailModule,
    ActivitiesModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, RenderCapacityService, RenderEtaService],
  exports: [JobsService, BullModule, MongooseModule],
})
export class JobsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsProcessor } from './jobs.processor';
import { Job, JobSchema } from './schemas/job.schema';
import { JOBS_QUEUE } from './jobs.constants';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    BullModule.registerQueue({ name: JOBS_QUEUE }),
    UsersModule,
    MediaModule,
    StorageModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
})
export class JobsModule { }
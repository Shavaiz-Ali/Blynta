import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';
import { JobsReconciliationService } from './jobs-reconciliation.service';
import { Job, JobSchema } from './schemas/job.schema';
import { JOBS_QUEUE } from './jobs.constants';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { ActivitiesModule } from '../activities/activities.module';
import { CommonModule } from '../common/common.module';
import { Connection } from 'mongoose';

const logger = new Logger('JobsWorkerMongoose');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () => {
            logger.log('MongoDB connected successfully');
          });
          connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`, err.stack);
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE }),
    UsersModule,
    MediaModule,
    StorageModule,
    NotificationsModule,
    MailModule,
    ActivitiesModule,
  ],
  providers: [JobsService, JobsProcessor, JobsReconciliationService],
})
export class JobsWorkerModule {}

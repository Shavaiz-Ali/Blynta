import { CreditsModule } from '../billing/credits.module';
import { CreditsRecoveryService } from './credits-recovery.service';
import { Module, Logger, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { RenderProcessor } from './render.processor';
import { RenderSourceService } from './render-source.service';
import { JobsCompletionService } from './jobs-completion.service';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';
import { RenderCapacityService } from './render-capacity.service';
import { RenderEtaService } from './render-eta.service';
import { JobsReconciliationService } from './jobs-reconciliation.service';
import { Job, JobSchema } from './schemas/job.schema';
import { JOBS_QUEUE, RENDER_QUEUE } from './jobs.constants';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { MediaRenderModule } from '../media/media-render.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { ActivitiesModule } from '../activities/activities.module';
import { CommonModule } from '../common/common.module';
import { Connection } from 'mongoose';
import { StudioModule } from '../studio/studio.module';
import { StudioProcessor } from '../studio/studio.processor';

const logger = new Logger('JobsWorkerMongoose');

@Module({
  imports: [
    CreditsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () => {
            logger.log('MongoDB connected successfully');
          });
          connection.on('error', (err: Error) => {
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
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE }, { name: RENDER_QUEUE }),
    UsersModule,
    StorageModule,
    NotificationsModule,
    MailModule,
    ActivitiesModule,
    StudioModule,
    BullModule.registerQueue({ name: 'studio' }),
  ],
  providers: [
    CreditsRecoveryService,
    JobsService,
    RenderCapacityService,
    RenderEtaService,
    JobsCompletionService,
    JobsReconciliationService,
    RenderSourceService,
  ],
})
export class JobsWorkerModule {
  static forRole(role = 'all'): DynamicModule {
    if (!['all', 'pipeline', 'render', 'studio'].includes(role))
      throw new Error(
        'MEDIA_WORKER_ROLE must be all, pipeline, render, or studio',
      );
    return {
      module: JobsWorkerModule,
      imports: [role === 'render' ? MediaRenderModule : MediaModule],
      providers: [
        ...(role === 'all' || role === 'pipeline' ? [JobsProcessor] : []),
        ...(role === 'all' || role === 'render' ? [RenderProcessor] : []),
        ...(role === 'all' || role === 'studio' ? [StudioProcessor] : []),
      ],
    };
  }
}

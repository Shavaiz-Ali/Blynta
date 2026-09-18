import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { Connection } from 'mongoose';
import {
  YouTubeConnection,
  YouTubeConnectionSchema,
} from './schemas/youtube-connection.schema';
import {
  ClipPublication,
  ClipPublicationSchema,
} from './schemas/clip-publication.schema';
import { YOUTUBE_PUBLISHING_QUEUE } from './youtube.constants';
import { YouTubeProcessor } from './youtube.processor';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubeApiService } from './youtube-api.service';
import { YouTubePublishingService } from './youtube-publishing.service';
import { CommonModule } from '../common/common.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsersModule } from '../users/users.module';

const logger = new Logger('YouTubeWorkerMongoose');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    RedisModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () => {
            logger.log('MongoDB connected successfully for YouTube Worker');
          });
          connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`, err.stack);
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: YouTubeConnection.name, schema: YouTubeConnectionSchema },
      { name: ClipPublication.name, schema: ClipPublicationSchema },
    ]),
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
    BullModule.registerQueue({ name: YOUTUBE_PUBLISHING_QUEUE }),
    StorageModule,
    JobsModule,
    UsersModule,
  ],
  providers: [
    YouTubeProcessor,
    YouTubeOAuthService,
    YouTubeApiService,
    YouTubePublishingService,
  ],
})
export class YouTubeWorkerModule {}

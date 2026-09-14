import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ActivitiesProcessor } from './activities.processor';
import { ActivitiesService } from './activities.service';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { ACTIVITIES_QUEUE } from './activities.constants';
import { CommonModule } from '../common/common.module';
import { Connection } from 'mongoose';

const logger = new Logger('ActivitiesWorkerMongoose');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
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
    BullModule.registerQueue({ name: ACTIVITIES_QUEUE }),
  ],
  providers: [ActivitiesProcessor, ActivitiesService],
})
export class ActivitiesWorkerModule {}

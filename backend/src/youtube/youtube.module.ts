import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  YouTubeConnection,
  YouTubeConnectionSchema,
} from './schemas/youtube-connection.schema';
import {
  ClipPublication,
  ClipPublicationSchema,
} from './schemas/clip-publication.schema';
import { YOUTUBE_PUBLISHING_QUEUE } from './youtube.constants';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubeApiService } from './youtube-api.service';
import { YouTubePublishingService } from './youtube-publishing.service';
import { YouTubeProcessor } from './youtube.processor';
import { YouTubeController } from './youtube.controller';
import { YouTubeClipController } from './youtube-clip.controller';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: YouTubeConnection.name, schema: YouTubeConnectionSchema },
      { name: ClipPublication.name, schema: ClipPublicationSchema },
    ]),
    BullModule.registerQueue({ name: YOUTUBE_PUBLISHING_QUEUE }),
    JobsModule,
    StorageModule,
  ],
  controllers: [YouTubeController, YouTubeClipController],
  providers: [
    YouTubeOAuthService,
    YouTubeApiService,
    YouTubePublishingService,
    YouTubeProcessor,
  ],
  exports: [
    YouTubePublishingService,
    YouTubeOAuthService,
    YouTubeApiService,
    MongooseModule,
    BullModule,
  ],
})
export class YouTubeModule {}

import { Module } from '@nestjs/common';
import { MediaRenderModule } from './media-render.module';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoDownloadService } from './services/video-download.service';
import { TranscriptionService } from './services/transcription.service';
import { HighlightDetectionService } from './services/highlight-detection.service';
import { SourceVideoService } from './services/source-video.service';
import {
  SourceVideo,
  SourceVideoSchema,
} from '../jobs/schemas/source-video.schema';

@Module({
  imports: [
    MediaRenderModule,
    MongooseModule.forFeature([
      { name: SourceVideo.name, schema: SourceVideoSchema },
    ]),
  ],
  providers: [
    VideoDownloadService,
    TranscriptionService,
    HighlightDetectionService,
    SourceVideoService,
  ],
  exports: [
    MediaRenderModule,
    VideoDownloadService,
    TranscriptionService,
    HighlightDetectionService,
    SourceVideoService,
  ],
})
export class MediaModule {}

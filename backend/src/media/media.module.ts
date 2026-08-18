import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoDownloadService } from './services/video-download.service';
import { TranscriptionService } from './services/transcription.service';
import { CaptionBurningService } from './services/caption-burning.service';
import { HighlightDetectionService } from './services/highlight-detection.service';
import { ClipCuttingService } from './services/clip-cutting.service';
import { SourceVideoService } from './services/source-video.service';
import { SourceVideo, SourceVideoSchema } from '../jobs/schemas/source-video.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceVideo.name, schema: SourceVideoSchema },
    ]),
  ],
  providers: [
    VideoDownloadService,
    TranscriptionService,
    CaptionBurningService,
    HighlightDetectionService,
    ClipCuttingService,
    SourceVideoService,
  ],
  exports: [
    VideoDownloadService,
    TranscriptionService,
    CaptionBurningService,
    HighlightDetectionService,
    ClipCuttingService,
    SourceVideoService,
  ],
})
export class MediaModule {}

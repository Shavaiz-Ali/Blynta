import { Module } from '@nestjs/common';
import { VideoDownloadService } from './services/video-download.service';
import { TranscriptionService } from './services/transcription.service';
import { CaptionBurningService } from './services/caption-burning.service';
import { HighlightDetectionService } from './services/highlight-detection.service';
import { ClipCuttingService } from './services/clip-cutting.service';

@Module({
  providers: [
    VideoDownloadService,
    TranscriptionService,
    CaptionBurningService,
    HighlightDetectionService,
    ClipCuttingService,
  ],
  exports: [
    VideoDownloadService,
    TranscriptionService,
    CaptionBurningService,
    HighlightDetectionService,
    ClipCuttingService,
  ],
})
export class MediaModule {}

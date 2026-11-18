import { Module } from '@nestjs/common';
import { CaptionBurningService } from './services/caption-burning.service';
import { ClipCuttingService } from './services/clip-cutting.service';
import { MediaInspectionService } from './services/media-inspection.service';
import { FaceDetectionService } from './services/face-detection.service';

/** Render processes do not need transcription/LLM credentials or provider clients. */
@Module({
  providers: [
    CaptionBurningService,
    ClipCuttingService,
    MediaInspectionService,
    FaceDetectionService,
  ],
  exports: [CaptionBurningService, ClipCuttingService, MediaInspectionService, FaceDetectionService],
})
export class MediaRenderModule {}

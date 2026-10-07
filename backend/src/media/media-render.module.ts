import { Module } from '@nestjs/common';
import { CaptionBurningService } from './services/caption-burning.service';
import { ClipCuttingService } from './services/clip-cutting.service';
import { MediaInspectionService } from './services/media-inspection.service';

/** Render processes do not need transcription/LLM credentials or provider clients. */
@Module({
  providers: [
    CaptionBurningService,
    ClipCuttingService,
    MediaInspectionService,
  ],
  exports: [CaptionBurningService, ClipCuttingService, MediaInspectionService],
})
export class MediaRenderModule {}

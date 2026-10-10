import { Module } from '@nestjs/common';
import { AIRegistryModule } from '../ai-registry/ai-registry.module';
import { MediaRenderModule } from './media-render.module';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoDownloadService } from './services/video-download.service';
import { TranscriptionService } from './services/transcription.service';
import { HighlightDetectionService } from './services/highlight-detection.service';
import { SourceVideoService } from './services/source-video.service';
import { PipelineCacheService } from './services/pipeline-cache.service';
import {
  PipelineArtifact,
  PipelineArtifactSchema,
} from '../jobs/schemas/pipeline-artifact.schema';
import { RedisModule } from '../redis/redis.module';
import {
  SourceVideo,
  SourceVideoSchema,
} from '../jobs/schemas/source-video.schema';

@Module({
  imports: [
    MediaRenderModule,
    AIRegistryModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: SourceVideo.name, schema: SourceVideoSchema },
      { name: PipelineArtifact.name, schema: PipelineArtifactSchema },
    ]),
  ],
  providers: [
    VideoDownloadService,
    TranscriptionService,
    HighlightDetectionService,
    SourceVideoService,
    PipelineCacheService,
  ],
  exports: [
    MediaRenderModule,
    VideoDownloadService,
    TranscriptionService,
    HighlightDetectionService,
    SourceVideoService,
    PipelineCacheService,
  ],
})
export class MediaModule {}

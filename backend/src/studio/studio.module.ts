import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '../storage/storage.module';
import { Job, JobSchema } from '../jobs/schemas/job.schema';
import {
  SourceVideo,
  SourceVideoSchema,
} from '../jobs/schemas/source-video.schema';
import {
  StudioProjectSchema,
  StudioAssetSchema,
  StudioRenderSchema,
} from './studio.schemas';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
const database = MongooseModule.forFeature([
  { name: 'StudioProject', schema: StudioProjectSchema },
  { name: 'StudioAsset', schema: StudioAssetSchema },
  { name: 'StudioRender', schema: StudioRenderSchema },
  { name: Job.name, schema: JobSchema },
  { name: SourceVideo.name, schema: SourceVideoSchema },
]);
@Module({
  imports: [
    database,
    StorageModule,
    BullModule.registerQueue({ name: 'studio' }),
  ],
  controllers: [StudioController],
  providers: [StudioService],
  exports: [database],
})
export class StudioModule {}

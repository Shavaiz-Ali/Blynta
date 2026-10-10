import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '../storage/storage.module';
import { MediaRenderModule } from '../media/media-render.module';
import { Job, JobSchema } from '../jobs/schemas/job.schema';
import { StudioAssetSchema } from '../studio/studio.schemas';
import {
  EditPlanSchema,
  EditVersionSchema,
  EditAdmissionSchema,
} from './edit.schemas';
import { EditPlansController } from './edit-plans.controller';
import { EDIT_QUEUE, EditPlansService } from './edit-plans.service';
import { EditPlanValidatorService } from './edit-plan-validator.service';
import { EditRenderService } from './edit-render.service';
import { RedisModule } from '../redis/redis.module';
import { EditAdmissionService } from './edit-admission.service';
import { EditRateLimitGuard } from './edit-rate-limit.guard';
const database = MongooseModule.forFeature([
  { name: 'EditPlan', schema: EditPlanSchema },
  { name: 'EditVersion', schema: EditVersionSchema },
  { name: 'EditAdmission', schema: EditAdmissionSchema },
  { name: Job.name, schema: JobSchema },
  { name: 'StudioAsset', schema: StudioAssetSchema },
]);
@Module({
  imports: [
    database,
    StorageModule,
    MediaRenderModule,
    RedisModule,
    BullModule.registerQueue({ name: EDIT_QUEUE }),
  ],
  controllers: [EditPlansController],
  providers: [
    EditAdmissionService,
    EditPlansService,
    EditPlanValidatorService,
    EditRenderService,
    EditRateLimitGuard,
  ],
  exports: [
    database,
    EditRenderService,
    EditAdmissionService,
    EditPlansService,
    EditPlanValidatorService,
  ],
})
export class AiEditorModule {}

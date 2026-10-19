import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '../storage/storage.module';
import { BatchExecutionSchema } from './batch-execution.schema';
import { BatchRenderService } from './batch-render.service';

@Module({
  imports: [
    StorageModule,
    MongooseModule.forFeature([
      { name: 'BatchExecution', schema: BatchExecutionSchema },
    ]),
  ],
  providers: [BatchRenderService],
  exports: [BatchRenderService],
})
export class BatchRenderModule {}

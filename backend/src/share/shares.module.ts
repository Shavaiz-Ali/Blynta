import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Share, ShareSchema } from './schemas/share.schema';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Share.name, schema: ShareSchema }]),
    JobsModule,    // provides JobsService for ownership checks + clip resolution
    StorageModule, // provides R2Service for signed URL generation
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}

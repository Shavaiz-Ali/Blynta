import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { ACTIVITIES_QUEUE, ACTIVITY_JOBS } from './activities.constants';
import { CreateActivityInput, ActivitiesService } from './activities.service';

@Processor(ACTIVITIES_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 3,
})
export class ActivitiesProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivitiesProcessor.name);

  constructor(private activitiesService: ActivitiesService) {
    super();
  }

  async process(job: BullJob): Promise<void> {
    switch (job.name) {
      case ACTIVITY_JOBS.CREATE: {
        const input = job.data as CreateActivityInput;
        await this.activitiesService.create(input);
        break;
      }

      case ACTIVITY_JOBS.CREATE_IF_NOT_EXISTS: {
        const input = job.data as CreateActivityInput;
        await this.activitiesService.createIfNotExists(input);
        break;
      }

      default:
        throw new Error(`Unknown activity job type: ${job.name}`);
    }
  }
}

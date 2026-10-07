import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { ACTIVITIES_QUEUE, ACTIVITY_JOBS } from './activities.constants';
import {
  activityTrace,
  CreateActivityInput,
  ActivitiesService,
} from './activities.service';

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
    if (
      job.name !== ACTIVITY_JOBS.CREATE &&
      job.name !== ACTIVITY_JOBS.CREATE_IF_NOT_EXISTS
    ) {
      throw new Error(`Unknown activity job type: ${job.name}`);
    }
    if (!job.id) throw new Error('Activity job must have a stable ID');
    const data = job.data as CreateActivityInput;
    // Also protect jobs queued before producers started supplying event keys.
    const input = {
      ...data,
      dedupeKey:
        data.dedupeKey ?? `activity:queue:${ACTIVITIES_QUEUE}:${job.id}`,
    };
    const trace = {
      ...activityTrace(input),
      activityJobId: job.id,
      attempt: job.attemptsMade + 1,
    };
    this.logger.log(JSON.stringify({ phase: 'activity.processing', ...trace }));
    const activity = await this.activitiesService.createIfNotExists(input);
    this.logger.log(
      JSON.stringify({
        phase: 'activity.persisted',
        ...trace,
        activityId: activity._id.toString(),
      }),
    );
  }
}

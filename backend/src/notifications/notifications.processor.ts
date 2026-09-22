import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOBS,
} from './notifications.constants';
import {
  CreateNotificationInput,
  NotificationsService,
} from './notifications.service';

@Processor(NOTIFICATIONS_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 3,
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private notificationsService: NotificationsService) {
    super();
  }

  async process(job: BullJob): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.CREATE: {
        const input = job.data as CreateNotificationInput;
        await this.notificationsService.create(input);
        break;
      }

      case NOTIFICATION_JOBS.CREATE_IF_NOT_EXISTS: {
        const input = job.data as CreateNotificationInput;
        await this.notificationsService.createIfNotExists(input);
        break;
      }

      default:
        throw new Error(`Unknown notification job type: ${job.name}`);
    }
  }
}

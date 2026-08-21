import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { JobStatus } from './schemas/job.schema';

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const PROCESSING_STATUSES = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

@Injectable()
export class JobsReconciliationService {
  private readonly logger = new Logger(JobsReconciliationService.name);

  constructor(private jobsService: JobsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileStuckJobs(): Promise<void> {
    if (process.env.RECONCILE_IN_WORKER !== 'true') {
      return;
    }

    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuckJobs = await this.jobsService.findStuckJobs(PROCESSING_STATUSES, cutoff);

    if (stuckJobs.length === 0) return;
    this.logger.warn(`Found ${stuckJobs.length} stuck job(s), marking as FAILED`);

    for (const job of stuckJobs) {
      const jobId = job._id.toString();
      await this.jobsService.updateJob(jobId, {
        status: JobStatus.FAILED,
        errorMessage: `Job exceeded ${STUCK_THRESHOLD_MS / 60000} minutes without progress — likely orphaned by a server restart or crash.`,
        errorStage: 'reconciliation',
      });
      this.logger.warn(`[${jobId}] Marked stuck job as FAILED (was status=${job.status})`);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { JobsService } from './jobs.service';
import { JobStatus } from './schemas/job.schema';

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const ABANDONED_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PROCESSING_STATUSES = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

@Injectable()
export class JobsReconciliationService {
  private readonly logger = new Logger(JobsReconciliationService.name);
  private readonly storageRoot: string;

  constructor(
    private jobsService: JobsService,
    private configService: ConfigService,
  ) {
    this.storageRoot = this.configService.get<string>('STORAGE_ROOT', '/var/blynta/storage');
  }

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

  // Sweeps jobDirs for FAILED jobs that have not been retried (updatedAt not
  // touched) for longer than ABANDONED_JOB_TTL_MS. Without this, a job that
  // fails and is never retried would leave its jobDir on disk forever, since
  // the processor's finally block now only cleans up on COMPLETED.
  //
  // Gated behind RECONCILE_IN_WORKER so only the worker process runs this,
  // matching the pattern of reconcileStuckJobs above.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepAbandonedFailedJobDirs(): Promise<void> {
    if (process.env.RECONCILE_IN_WORKER !== 'true') {
      return;
    }

    const cutoff = new Date(Date.now() - ABANDONED_JOB_TTL_MS);
    const abandonedJobs = await this.jobsService.findAbandonedFailedJobs(cutoff);

    if (abandonedJobs.length === 0) return;
    this.logger.log(`Sweeping ${abandonedJobs.length} abandoned failed job director(ies) (older than 7 days)`);

    for (const job of abandonedJobs) {
      const jobId = job._id.toString();
      const jobDir = path.join(this.storageRoot, 'jobs', jobId);
      try {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
        this.logger.log(`[${jobId}] Swept abandoned failed job directory: ${jobDir}`);
      } catch (err) {
        this.logger.warn(
          `[${jobId}] Failed to sweep job directory ${jobDir}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}

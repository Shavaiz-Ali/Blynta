import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { JobsService } from './jobs.service';
import { JobsCompletionService } from './jobs-completion.service';
import { JobStatus } from './schemas/job.schema';

const ABANDONED_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class JobsReconciliationService {
  private readonly logger = new Logger(JobsReconciliationService.name);
  private readonly storageRoot: string;

  constructor(
    private jobsService: JobsService,
    private completion: JobsCompletionService,
    private configService: ConfigService,
  ) {
    this.storageRoot = this.configService.get<string>(
      'STORAGE_ROOT',
      '/var/blynta/storage',
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileStuckJobs(): Promise<void> {
    if (this.configService.get('RECONCILE_IN_WORKER', 'true') !== 'true') {
      return;
    }

    const jobs = await this.jobsService.reconcileMediaJobs();
    for (const jobId of jobs) {
      try {
        await this.completion.publish(jobId);
      } catch (error) {
        this.logger.warn(
          `[jobId=${jobId}] Completion reconciliation failed: ${error}`,
        );
      }
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
    if (this.configService.get('RECONCILE_IN_WORKER', 'true') !== 'true') {
      return;
    }

    const cutoff = new Date(Date.now() - ABANDONED_JOB_TTL_MS);
    const activeIds = await this.jobsService.activeMediaJobIds();
    const abandonedJobs =
      await this.jobsService.findAbandonedFailedJobs(cutoff);

    this.logger.log(
      `Sweeping ${abandonedJobs.length} abandoned failed job director(ies) (older than 7 days)`,
    );

    for (const job of abandonedJobs) {
      const jobId = job._id.toString();
      if (job.activeExecutions?.length || activeIds.has(jobId)) continue;
      const jobDir = path.join(this.storageRoot, 'jobs', jobId);
      try {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
        this.logger.log(
          `[${jobId}] Swept abandoned failed job directory: ${jobDir}`,
        );
      } catch (err) {
        this.logger.warn(
          `[${jobId}] Failed to sweep job directory ${jobDir}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    // Hard-killed workers cannot execute finally. Sweep only old, terminal/orphaned
    // workspaces, and never an active Bull job or a symlink to another directory.
    for (const folder of ['renders', 'render-sources']) {
      const root = path.resolve(this.storageRoot, folder);
      const entries = await fs.promises
        .readdir(root, { withFileTypes: true })
        .catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const jobId = /^([a-f0-9]{24})-/.exec(entry.name)?.[1];
        if (!jobId || activeIds.has(jobId)) continue;
        const directory = path.resolve(root, entry.name);
        if (path.dirname(directory) !== root) continue;
        const stat = await fs.promises.stat(directory).catch(() => undefined);
        if (!stat || stat.mtime >= cutoff) continue;
        const parent = await this.jobsService.findJob(jobId);
        if (
          parent &&
          (parent.activeExecutions?.length ||
            ![
              JobStatus.COMPLETED,
              JobStatus.FAILED,
              JobStatus.CANCELLED,
            ].includes(parent.status))
        )
          continue;
        await fs.promises.rm(directory, { recursive: true, force: true });
      }
    }
  }
}

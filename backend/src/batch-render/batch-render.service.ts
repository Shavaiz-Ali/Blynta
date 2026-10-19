import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Connection, Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BatchClient,
  SubmitJobCommand,
  DescribeJobsCommand,
  TerminateJobCommand,
  CancelJobCommand,
} from '@aws-sdk/client-batch';
import { R2Service } from '../storage/r2.service';
import {
  assertNotCancelled,
  cancellationSignal,
} from '../jobs/cancellation-context';
import type { BatchExecution } from './batch-execution.schema';
import {
  integerSetting,
  renderMode,
  RenderTask,
  RenderResult,
  assertBatchStorage,
} from './render-task';

@Injectable()
export class BatchRenderService {
  private readonly logger = new Logger(BatchRenderService.name);
  // SubmitJob is deliberately NOT automatically retried: AWS offers no client token.
  private readonly client: BatchClient;
  private reconciling = false;
  private reconcileAfter?: string;
  constructor(
    private config: ConfigService,
    private r2: R2Service,
    @InjectModel('BatchExecution') private executions: Model<BatchExecution>,
    @Optional() @InjectConnection() private connection?: Connection,
  ) {
    renderMode(config.get('RENDER_EXECUTION_MODE', 'local'));
    this.client = new BatchClient({
      region: config.get('AWS_REGION', 'ap-south-1'),
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 },
    });
  }
  get enabled() {
    return (
      renderMode(this.config.get('RENDER_EXECUTION_MODE', 'local')) ===
      'aws_batch'
    );
  }
  async status(jobId: string) {
    const result = await this.client.send(
      new DescribeJobsCommand({ jobs: [jobId] }),
    );
    if (!result.jobs?.[0]) throw new Error('AWS Batch job not found');
    return result.jobs[0];
  }
  async cancel(jobId: string) {
    // Cancel queued work and terminate work that raced into STARTING/RUNNING.
    await this.client.send(
      new CancelJobCommand({
        jobId,
        reason: 'Blynta render cancelled or expired',
      }),
    );
    await this.client.send(
      new TerminateJobCommand({
        jobId,
        reason: 'Blynta render cancelled or expired',
      }),
    );
  }
  async execute(
    identity: string,
    prepare: (prefix: string, deadline: number) => Promise<RenderTask>,
    progress: (phase: string, percent: number) => Promise<void>,
    owner?: BatchExecution['owner'],
  ): Promise<RenderResult> {
    assertNotCancelled();
    assertBatchStorage(this.config);
    const id = createHash('sha256').update(identity).digest('hex');
    const prefix = `job-sources/batch/${id}`;
    const total = integerSetting(
      this.config.get('BATCH_TOTAL_TIMEOUT_SECONDS', 7200),
      60,
      86400,
    );
    let record = await this.executions.findById(id).lean();
    if (!record) {
      try {
        record = (
          await this.executions.create({
            _id: id,
            prefix,
            owner,
            state: 'PREPARING',
            deadline: new Date(Date.now() + total * 1000),
          })
        ).toObject();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        record = await this.executions.findById(id).lean();
      }
      if (record?.state === 'PREPARING') {
        // Claim PREPARING -> SUBMITTING atomically, including against another caller.
        const claimed = await this.executions.updateOne(
          { _id: id, state: 'PREPARING' },
          { $set: { state: 'SUBMITTING' } },
        );
        if (claimed.modifiedCount) {
          let submitted = false;
          try {
            const deadline = new Date(record.deadline).getTime();
            const task = await prepare(prefix, deadline);
            await this.r2.uploadBuffer(
              Buffer.from(JSON.stringify(task)),
              `${prefix}/task.json`,
              'application/json',
            );
            assertNotCancelled();
            if (Date.now() >= deadline)
              throw new Error('Batch preparation deadline exceeded');
            const runtime = integerSetting(
              this.config.get('BATCH_RENDER_TIMEOUT_SECONDS', 3600),
              60,
              86400,
            );
            const attempts = integerSetting(
              this.config.get('BATCH_RENDER_ATTEMPTS', 2),
              1,
              3,
            );
            const vcpu = String(this.config.get('BATCH_RENDER_VCPU', '2'));
            const memory = String(
              integerSetting(
                this.config.get('BATCH_RENDER_MEMORY_MIB', 4096),
                512,
                122880,
              ),
            );
            if (!['0.25', '0.5', '1', '2', '4', '8', '16'].includes(vcpu))
              throw new Error('Invalid Fargate vCPU');
            const jobQueue = this.config.get<string>(
              'BATCH_RENDER_QUEUE',
              'blynta-render-queue',
            );
            const jobDefinition = this.config.get<string>(
              'BATCH_RENDER_JOB_DEFINITION',
              'blynta-render-job',
            );
            submitted = true;
            const response = await this.client.send(
              new SubmitJobCommand({
                jobName: `blynta-${id}`,
                jobQueue,
                jobDefinition,
                retryStrategy: { attempts },
                timeout: { attemptDurationSeconds: runtime },
                containerOverrides: {
                  command: [
                    'node',
                    'dist/src/batch-render/renderer.main.js',
                    `${prefix}/task.json`,
                  ],
                  resourceRequirements: [
                    { type: 'VCPU', value: vcpu },
                    { type: 'MEMORY', value: memory },
                  ],
                },
              }),
            );
            if (!response.jobId)
              throw new Error('Batch submission returned no job ID');
            await this.executions.updateOne(
              { _id: id },
              { $set: { jobId: response.jobId, state: 'SUBMITTED' } },
            );
          } catch (error) {
            await this.executions.updateOne(
              { _id: id },
              {
                $set: {
                  state: submitted ? 'UNKNOWN' : 'FAILED',
                  error: submitted
                    ? 'Ambiguous AWS submission; inspect job name before manual recovery'
                    : 'Task preparation failed',
                },
              },
            );
            throw error;
          }
        }
      }
    }
    const poll = integerSetting(
      this.config.get('BATCH_POLL_INTERVAL_MS', 5000),
      100,
      60000,
    );
    for (;;) {
      record = await this.executions.findById(id).lean();
      if (!record) throw new Error('Batch execution record missing');
      if (['UNKNOWN', 'FAILED', 'CANCELLED'].includes(record.state))
        throw new Error(record.error || `Batch render ${record.state}`);
      if (
        cancellationSignal()?.aborted ||
        Date.now() >= new Date(record.deadline).getTime()
      ) {
        if (record.jobId) await this.cancel(record.jobId);
        await this.executions.updateOne(
          { _id: id },
          {
            $set: {
              state: 'CANCELLED',
              error: 'Render cancelled or timed out',
            },
          },
        );
        throw new Error('Batch render cancelled or timed out');
      }
      if (record.jobId) {
        const job = await this.status(record.jobId);
        if (job.status === 'FAILED') {
          await this.executions.updateOne(
            { _id: id },
            {
              $set: {
                state: 'FAILED',
                error: 'AWS Batch task failed; inspect CloudWatch logs',
              },
            },
          );
          throw new Error('AWS Batch task failed; inspect CloudWatch logs');
        }
        if (job.status === 'SUCCEEDED') {
          const result = JSON.parse(
            (
              await this.r2.downloadToBuffer(`${prefix}/result.json`, 16384)
            ).toString(),
          ) as RenderResult;
          if (
            result.jobId !== record.jobId ||
            result.outputKey !== `${prefix}/output.mp4` ||
            !Number.isSafeInteger(result.bytes) ||
            result.bytes <= 0
          )
            throw new Error('Invalid Batch result identity');
          const info = await this.r2.objectInfo(result.outputKey);
          if (info.size !== result.bytes)
            throw new Error('Batch output verification failed');
          assertNotCancelled();
          await this.executions.updateOne(
            { _id: id },
            { $set: { state: 'SUCCEEDED' } },
          );
          return result;
        }
        if (await this.r2.fileExists(`${prefix}/progress.json`)) {
          const tick = JSON.parse(
            (
              await this.r2.downloadToBuffer(`${prefix}/progress.json`, 16384)
            ).toString(),
          ) as { jobId?: unknown; phase?: unknown; percent?: unknown };
          if (
            tick.jobId === record.jobId &&
            typeof tick.phase === 'string' &&
            typeof tick.percent === 'number' &&
            Number.isFinite(tick.percent)
          )
            await progress(tick.phase, Math.min(99, Math.max(0, tick.percent)));
        }
      }
      // Short bounded wait; the next iteration propagates cancellation to AWS.
      await delay(poll);
    }
  }

  @Interval(30000)
  async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const stale = await this.executions
        .find({
          state: { $in: ['PREPARING', 'SUBMITTING', 'SUBMITTED', 'UNKNOWN'] },
          ...(this.reconcileAfter ? { _id: { $gt: this.reconcileAfter } } : {}),
        })
        .sort({ _id: 1 })
        .limit(100)
        .lean();
      this.reconcileAfter =
        stale.length === 100 ? stale.at(-1)?._id : undefined;
      for (const record of stale) {
        let cancelled = new Date(record.deadline).getTime() <= Date.now();
        if (!cancelled && this.connection && record.owner?.jobId) {
          const parent = await this.connection
            .collection('jobs')
            .findOne({ _id: new Types.ObjectId(record.owner.jobId) });
          cancelled =
            !parent ||
            !!parent.cancellationRequestedAt ||
            !!parent.deletionRequested;
        } else if (!cancelled && this.connection && record.owner?.planId) {
          const version = await this.connection
            .collection('editversions')
            .findOne({
              planId: record.owner.planId,
              revision: record.owner.revision,
            });
          cancelled =
            !version ||
            version.status === 'cancelled' ||
            (version.generation ?? 0) !== (record.owner.generation ?? 0);
        }
        if (!cancelled) continue;
        if (!record.jobId) {
          await this.executions.updateOne(
            { _id: record._id, jobId: { $exists: false } },
            {
              $set: {
                state: 'UNKNOWN',
                error:
                  'Submission interrupted; inspect AWS job name before recovery',
              },
            },
          );
          continue;
        }
        await this.cancel(record.jobId);
        await this.executions.updateOne(
          { _id: record._id },
          {
            $set: {
              state: 'CANCELLED',
              error: 'Batch execution cancelled or deadline exceeded',
            },
          },
        );
      }
    } catch {
      this.logger.warn(
        'Batch reconciliation deferred; verify AWS connectivity',
      );
    } finally {
      this.reconciling = false;
    }
  }
}

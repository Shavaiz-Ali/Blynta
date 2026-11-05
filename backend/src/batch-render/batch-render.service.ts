import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Connection, Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { UnrecoverableError } from 'bullmq';
import {
  BatchClient,
  SubmitJobCommand,
  DescribeJobsCommand,
  TerminateJobCommand,
  CancelJobCommand,
} from '@aws-sdk/client-batch';
import { R2Service } from '../storage/r2.service';
import {
  withR2ObjectContext,
  isObjectMissing,
} from '../storage/r2-object-context';
import { r2FailureDetails } from '../storage/r2-diagnostics';
import {
  renderFailure,
  terminalRenderFailure,
  validFailure,
  RenderFailureDetail,
} from './render-failure';
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
  assertBatchTaskKeys,
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
    if (!result.jobs?.[0])
      throw Object.assign(new Error('AWS Batch job not visible yet'), {
        name: 'BatchJobNotVisible',
      });
    return result.jobs[0];
  }
  async cancel(jobId: string) {
    // Cancel queued work and terminate work that raced into STARTING/RUNNING.
    try {
      await this.client.send(
        new CancelJobCommand({
          jobId,
          reason: 'Blynta render cancelled or expired',
        }),
      );
    } catch {
      // CancelJob can race with STARTING/RUNNING. Always attempt TerminateJob.
      this.logger.warn({
        event: 'batch.cancel_raced_or_failed',
        batchJobId: jobId,
      });
    }
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
    const fail = async (detail: RenderFailureDetail) => {
      await this.executions.updateOne(
        { _id: id },
        {
          $set: {
            state: 'FAILED',
            error: `${detail.code}: Render could not be completed.`,
            failureCode: detail.code,
            failureStage: detail.stage,
            retryable: false,
          },
        },
      );
      throw terminalRenderFailure({ ...detail, retryable: false });
    };
    const total = integerSetting(
      this.config.get('BATCH_TOTAL_TIMEOUT_SECONDS', 7200),
      60,
      86400,
    );
    let record = await this.executions.findById(id).lean();
    if (!record) {
      if (owner?.jobId && owner.clipId) {
        const active = await this.executions
          .findOne({
            'owner.jobId': owner.jobId,
            'owner.clipId': owner.clipId,
            state: { $in: ['PREPARING', 'SUBMITTING', 'SUBMITTED', 'UNKNOWN'] },
          })
          .lean();
        if (active && active._id !== id)
          throw terminalRenderFailure({
            code: 'RENDER_PREVIOUS_ATTEMPT_ACTIVE',
            stage: 'submission',
            retryable: false,
          });
      }
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
    }
    if (record?.state === 'PREPARING') {
      // Claim PREPARING -> SUBMITTING atomically, including against another caller.
      const claimed = await this.executions.updateOne(
        { _id: id, state: 'PREPARING' },
        { $set: { state: 'SUBMITTING' } },
      );
      if (claimed.modifiedCount) {
        let submitted = false;
        let preparationStage = 'manifest_upload';
        try {
          const deadline = new Date(record.deadline).getTime();
          const task = await prepare(prefix, deadline);
          if (owner?.jobId)
            task.owner = { jobId: owner.jobId, clipId: owner.clipId };
          assertBatchTaskKeys(task, prefix);
          await this.executions.updateOne(
            { _id: id },
            {
              $set: {
                outputKey: task.outputKey,
                durationSeconds:
                  task.kind === 'clip' ? task.end - task.start : task.duration,
              },
            },
          );
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
            throw new UnrecoverableError('Invalid Fargate vCPU');
          const jobQueue = this.config.get<string>(
            'BATCH_RENDER_QUEUE',
            'blynta-render-queue',
          );
          const jobDefinition = this.config.get<string>(
            'BATCH_RENDER_JOB_DEFINITION',
            'blynta-render-job',
          );
          preparationStage = 'submission';
          submitted = true;
          const response = await this.client.send(
            new SubmitJobCommand({
              jobName: `blynta-${id}`,
              jobQueue,
              jobDefinition,
              retryStrategy: {
                attempts,
                evaluateOnExit: [{ onExitCode: '2', action: 'EXIT' }],
              },
              timeout: { attemptDurationSeconds: runtime },
              containerOverrides: {
                // Keep storage routing consistent with the submitting worker. Secrets
                // stay in the job definition and never enter manifests or overrides.
                environment: [
                  'R2_BUCKET_NAME',
                  'R2_SOURCE_BUCKET_NAME',
                  'R2_ENDPOINT',
                ].map((name) => ({
                  name,
                  value: this.config.get<string>(name)!,
                })),
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
          this.logger.log({
            event: 'batch.submitted',
            ...owner,
            executionId: id,
            batchJobId: response.jobId,
            manifestKey: `${prefix}/task.json`,
            outputKey: task.outputKey,
            jobQueue,
            jobDefinition,
          });
        } catch (error) {
          await this.executions.updateOne(
            { _id: id },
            {
              $set: {
                state: submitted ? 'UNKNOWN' : 'FAILED',
                error: submitted
                  ? 'Ambiguous AWS submission; inspect job name before manual recovery'
                  : 'Task preparation failed',
                failureCode: renderFailure(error, preparationStage).code,
                failureStage: preparationStage,
                ...(error instanceof UnrecoverableError
                  ? { retryable: false }
                  : {}),
              },
            },
          );
          throw error;
        }
      }
    }
    const poll = integerSetting(
      this.config.get('BATCH_POLL_INTERVAL_MS', 5000),
      100,
      60000,
    );
    let statusFailures = 0;
    let verificationFailures = 0;
    let progressWarning = false;
    const temporary = (error: unknown) => {
      const e = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const status = e.$metadata?.httpStatusCode;
      return (
        (status !== undefined &&
          (status >= 500 || [408, 429].includes(status))) ||
        [
          'BatchJobNotVisible',
          'TimeoutError',
          'RequestTimeout',
          'NetworkingError',
          'ECONNRESET',
          'ETIMEDOUT',
        ].includes(e.name ?? '')
      );
    };
    for (;;) {
      record = await this.executions.findById(id).lean();
      if (!record) throw new Error('Batch execution record missing');
      if (record.state === 'FAILED' && record.retryable === false)
        throw new UnrecoverableError(
          record.error || 'Invalid Batch task configuration or input',
        );
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
              failureCode: 'RENDER_TIMEOUT',
              failureStage: 'timeout',
            },
          },
        );
        throw terminalRenderFailure({
          code: 'RENDER_TIMEOUT',
          stage: 'timeout',
          retryable: false,
        });
      }
      if (record.jobId) {
        let job: Awaited<ReturnType<BatchRenderService['status']>>;
        let progressTick: { phase: string; percent: number } | undefined;
        try {
          job = await this.status(record.jobId);
          statusFailures = 0;
        } catch (error) {
          if (!temporary(error) || ++statusFailures > 3) throw error;
          this.logger.warn({
            event: 'batch.status_deferred',
            ...record.owner,
            batchJobId: record.jobId,
            failures: statusFailures,
          });
          await delay(Math.min(poll * 2 ** (statusFailures - 1), 60000));
          continue;
        }
        const container = job.container ?? job.attempts?.at(-1)?.container;
        const diagnostics = {
          statusReason: r2FailureDetails({ message: job.statusReason }).message,
          containerReason: r2FailureDetails({ message: container?.reason })
            .message,
          exitCode: container?.exitCode,
          logStreamName: container?.logStreamName,
          jobDefinition: job.jobDefinition,
          image: job.container?.image,
          attempts: job.attempts?.length,
        };
        if (record.lastBatchStatus !== job.status) {
          await this.executions.updateOne(
            { _id: id },
            { $set: { lastBatchStatus: job.status, diagnostics } },
          );
          this.logger.log({
            event: 'batch.status',
            ...record.owner,
            batchJobId: record.jobId,
            executionId: id,
            status: job.status,
            ...diagnostics,
          });
        }
        if (job.status === 'FAILED') {
          let detail: RenderFailureDetail = {
            code:
              container?.exitCode === undefined
                ? 'RENDER_BATCH_START_FAILED'
                : 'RENDER_BATCH_FAILED',
            stage: 'container',
            retryable: false,
          };
          const failureKey = `${prefix}/failure.json`;
          try {
            await withR2ObjectContext(
              {
                ...record.owner,
                batchJobId: record.jobId,
                artifactType: 'failure',
                expectedToExist: false,
              },
              async () => {
                if (!(await this.r2.fileExists(failureKey))) return;
                const marker: unknown = JSON.parse(
                  (await this.r2.downloadToBuffer(failureKey, 4096)).toString(),
                );
                const identity = marker as {
                  jobId?: unknown;
                  attempt?: unknown;
                } | null;
                if (
                  validFailure(marker) &&
                  identity?.jobId === record!.jobId &&
                  identity?.attempt === Math.max(1, job.attempts?.length ?? 0)
                )
                  detail = {
                    code: marker.code,
                    stage: marker.stage,
                    retryable: marker.retryable,
                  };
              },
            );
          } catch {
            /* Batch failure remains authoritative when its optional diagnostic is unavailable. */
          }
          this.logger.error({
            event: 'batch.failed',
            ...record.owner,
            batchJobId: record.jobId,
            ...detail,
            ...diagnostics,
          });
          await fail(detail);
        }
        if (job.status === 'SUCCEEDED') {
          try {
            const result: unknown = JSON.parse(
              (
                await this.r2.downloadToBuffer(`${prefix}/result.json`, 16384)
              ).toString(),
            );
            if (
              !result ||
              typeof result !== 'object' ||
              (result as RenderResult).jobId !== record.jobId ||
              (result as RenderResult).outputKey !== `${prefix}/output.mp4` ||
              !Number.isSafeInteger((result as RenderResult).bytes) ||
              (result as RenderResult).bytes <= 0
            )
              return await fail({
                code: 'RENDER_OUTPUT_INVALID',
                stage: 'result_verification',
                retryable: false,
              });
            const verified = result as RenderResult;
            if (
              (verified.durationSeconds !== undefined &&
                (!Number.isFinite(verified.durationSeconds) ||
                  verified.durationSeconds <= 0 ||
                  (record.durationSeconds !== undefined &&
                    Math.abs(
                      verified.durationSeconds - record.durationSeconds,
                    ) > 0.25))) ||
              (verified.hasVideo !== undefined && verified.hasVideo !== true)
            )
              return await fail({
                code: 'RENDER_OUTPUT_INVALID',
                stage: 'media_verification',
                retryable: false,
              });
            const info = await withR2ObjectContext(
              {
                ...record.owner,
                batchJobId: record.jobId,
                artifactType: 'batch_output',
                expectedToExist: true,
              },
              () => this.r2.objectInfo(verified.outputKey),
            );
            if (
              info.size !== verified.bytes ||
              (info.contentType && info.contentType !== 'video/mp4')
            )
              return await fail({
                code: 'RENDER_OUTPUT_INVALID',
                stage: 'output_verification',
                retryable: false,
              });
            assertNotCancelled();
            await this.executions.updateOne(
              { _id: id },
              { $set: { state: 'SUCCEEDED' } },
            );
            return verified;
          } catch (error) {
            if (error instanceof UnrecoverableError) throw error;
            // Reuse the existing poll cadence for bounded post-success visibility checks.
            if (
              (isObjectMissing(error) || temporary(error)) &&
              ++verificationFailures < 3
            ) {
              await delay(poll);
              continue;
            }
            return await fail({
              code: isObjectMissing(error)
                ? 'RENDER_OUTPUT_NOT_FOUND'
                : 'RENDER_OUTPUT_INVALID',
              stage: 'output_verification',
              retryable: false,
            });
          }
        }
        try {
          progressTick = await withR2ObjectContext(
            {
              ...record.owner,
              batchJobId: record.jobId,
              artifactType: 'progress',
              expectedToExist: false,
            },
            async () => {
              if (await this.r2.fileExists(`${prefix}/progress.json`)) {
                const tick = JSON.parse(
                  (
                    await this.r2.downloadToBuffer(
                      `${prefix}/progress.json`,
                      16384,
                    )
                  ).toString(),
                ) as { jobId?: unknown; phase?: unknown; percent?: unknown };
                if (
                  tick.jobId === record!.jobId &&
                  typeof tick.phase === 'string' &&
                  typeof tick.percent === 'number' &&
                  Number.isFinite(tick.percent)
                )
                  return {
                    phase: tick.phase,
                    percent: Math.min(99, Math.max(0, tick.percent)),
                  };
              }
            },
          );
        } catch {
          if (!progressWarning)
            this.logger.warn({
              event: 'batch.progress_unavailable',
              ...record.owner,
              batchJobId: record.jobId,
            });
          progressWarning = true;
        }
        if (progressTick)
          await progress(progressTick.phase, progressTick.percent);
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

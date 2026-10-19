import { EDIT_LIMITS } from './edit.constants';
import { EDIT_RENDER_JOB, EDIT_JOB_OPTIONS } from './edit.constants';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Job, Queue, UnrecoverableError, DelayedError } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import {
  mediaExecution,
  assertNotCancelled,
  drainMediaChildren,
} from '../jobs/cancellation-context';
import { workerConcurrency } from '../jobs/jobs.constants';
import { R2Service } from '../storage/r2.service';
import { EditRenderService } from './edit-render.service';
import type { EditVersion, StoredEditPlan } from './edit.schemas';
import { EditAdmissionService, editJobId } from './edit-admission.service';
import { renderFailure } from './render-failure';
import { EDIT_QUEUE } from './edit-plans.service';
import {
  EDIT_RENDER_PHASE,
  type EditRenderPhase,
} from '@blynta/types/contracts';

@Processor(EDIT_QUEUE, {
  concurrency: 1,
  autorun: false,
  lockDuration: 60000,
  maxStalledCount: 2,
})
export class EditRenderProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private logger = new Logger(EditRenderProcessor.name);
  private reconciling = false;
  constructor(
    @InjectModel('EditVersion') private versions: Model<EditVersion>,
    @InjectModel('EditPlan') private plans: Model<StoredEditPlan>,
    private renderer: EditRenderService,
    private r2: R2Service,
    private config: ConfigService,
    @InjectQueue(EDIT_QUEUE) private queue: Queue,
    private admission: EditAdmissionService,
  ) {
    super();
  }
  onApplicationBootstrap() {
    this.worker.concurrency = workerConcurrency(
      this.config.get('EDIT_RENDER_CONCURRENCY'),
      'EDIT_RENDER_CONCURRENCY',
    );
    this.worker.on('error', (e) => this.logger.error(e));
    void this.worker.run().catch((e) => this.logger.error(e));
  }
  @Interval(30000)
  async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      await this.cleanAbandonedWorkspaces();
      await this.admission.reconcile(this.versions);
      const pending = await this.versions
        .find({
          status: { $in: ['queued', 'processing'] },
          $or: [
            { executionToken: { $exists: false } },
            { executionExpiresAt: { $lt: new Date() } },
          ],
        })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();
      for (const v of pending) {
        try {
          const job = await this.queue.getJob(
            editJobId(String(v._id), v.generation),
          );
          const state = await job?.getState();
          if (state === 'failed' || state === 'completed') {
            const marked = await this.versions.updateOne(
              {
                _id: v._id,
                status: { $in: ['queued', 'processing'] },
                executionToken: v.executionToken,
              },
              {
                $set: {
                  status: 'failed',
                  phase: EDIT_RENDER_PHASE.FAILED,
                  failedPhase: v.phase ?? EDIT_RENDER_PHASE.PREPARING,
                  errorCode: 'EDIT_EXECUTION_INTERRUPTED',
                  retryable: true,
                  progress: 0,
                  error:
                    'Worker stopped before publication; retry this failed version',
                },
                $unset: { executionToken: '', executionExpiresAt: '' },
              },
            );
            if (marked.modifiedCount)
              await this.plans.updateOne(
                { _id: v.planId, revision: v.revision },
                { $set: { status: 'failed' } },
              );
          } else if (!job)
            await this.queue.add(
              EDIT_RENDER_JOB,
              { versionId: String(v._id), generation: v.generation ?? 0 },
              {
                jobId: editJobId(String(v._id), v.generation),
                ...EDIT_JOB_OPTIONS,
              },
            );
        } catch {
          this.logger.warn('Editing queue repair deferred');
        }
      }
      const abandoned = await this.versions
        .find({
          pendingOutputKeys: { $exists: true, $ne: [] },
          $or: [
            { executionToken: { $exists: false } },
            { executionExpiresAt: { $lt: new Date() } },
          ],
        })
        .sort({ updatedAt: 1 })
        .limit(100)
        .lean();
      for (const v of abandoned) {
        for (const key of v.pendingOutputKeys ?? []) {
          if (key === v.outputKey) continue;
          try {
            await this.r2.deleteFile(key);
            await this.versions.updateOne(
              { _id: v._id },
              { $pull: { pendingOutputKeys: key } },
            );
          } catch {
            this.logger.warn('Editing attempt cleanup deferred');
          }
        }
      }
      const stalePlans = await this.plans
        .find({ status: { $in: ['queued', 'processing'] } })
        .sort({ updatedAt: 1 })
        .limit(100)
        .lean();
      for (const p of stalePlans) {
        try {
          const v = await this.versions
            .findOne({
              planId: String(p._id),
              revision: p.revision,
              profile: 'preview',
            })
            .lean();
          if (v && ['completed', 'failed', 'cancelled'].includes(v.status))
            await this.plans.updateOne(
              { _id: p._id, revision: p.revision, status: p.status },
              { $set: { status: v.status } },
            );
        } catch {
          this.logger.warn('Editing plan state repair deferred');
        }
      }
    } catch (error) {
      this.logger.error('Editing queue reconciliation failed', error);
    } finally {
      this.reconciling = false;
    }
  }
  private async cleanAbandonedWorkspaces() {
    const root = await realpath(tmpdir());
    const entries = await readdir(tmpdir(), { withFileTypes: true });
    for (const entry of entries
      .filter(
        (e) =>
          e.isDirectory() &&
          /^blynta-edit-[a-f\d]{24}-[\d]+-[\w-]+$/.test(e.name),
      )
      .slice(0, 100)) {
      const directory = join(tmpdir(), entry.name);
      try {
        const resolved = await realpath(directory);
        if (
          dirname(resolved).toLowerCase() !== root.toLowerCase() ||
          basename(resolved) !== entry.name
        )
          continue;
        if (Date.now() - (await stat(directory)).mtimeMs < 7800000) continue;
        const id = entry.name.slice(
          'blynta-edit-'.length,
          'blynta-edit-'.length + 24,
        );
        const active = await this.versions.exists({
          _id: id,
          status: 'processing',
          executionExpiresAt: { $gt: new Date() },
        });
        if (!active) await rm(directory, { recursive: true, force: true });
      } catch {
        this.logger.warn('Editing workspace cleanup deferred');
      }
    }
  }
  async process(
    job: Job<{ versionId: string; generation?: number }>,
    token?: string,
  ) {
    if (job.name !== EDIT_RENDER_JOB)
      throw new UnrecoverableError(
        'Only preview rendering is supported in Phase 1',
      );
    const timeout = Number(
      this.config.get(
        'EDIT_RENDER_TIMEOUT_SECONDS',
        EDIT_LIMITS.RENDER_TIMEOUT_SECONDS,
      ),
    );
    if (!Number.isInteger(timeout) || timeout < 10 || timeout > 7200)
      throw new UnrecoverableError('Invalid editing render timeout');
    const startedAt = Date.now();
    const executionToken = randomUUID();
    const v = await this.versions.findOneAndUpdate(
      {
        _id: job.data.versionId,
        ...(job.data.generation
          ? { generation: job.data.generation }
          : {
              $and: [
                {
                  $or: [{ generation: 0 }, { generation: { $exists: false } }],
                },
              ],
            }),
        status: { $in: ['queued', 'processing'] },
        $or: [
          { executionToken: { $exists: false } },
          { executionExpiresAt: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          status: 'processing',
          progress: 0,
          phase: EDIT_RENDER_PHASE.PREPARING,
          attempt: job.attemptsMade + 1,
          executionToken,
          executionExpiresAt: new Date(Date.now() + 60000),
        },
        $unset: { error: '', errorCode: '', retryable: '', failureDetails: '' },
      },
      { returnDocument: 'after' },
    );
    if (!v) {
      const existing = await this.versions.findById(job.data.versionId);
      if (existing && (existing.generation ?? 0) !== (job.data.generation ?? 0))
        return;
      if (existing && ['queued', 'processing'].includes(existing.status)) {
        // A stalled job must not race an execution that still holds its DB lease.
        if (!token) throw new Error('Render is already executing');
        await job.moveToDelayed(Date.now() + 30000, token);
        throw new DelayedError();
      }
      return;
    }
    this.logger.log(
      JSON.stringify({
        event: 'edit_render_started',
        versionId: String(v._id),
        revision: v.revision,
        attempt: job.attemptsMade + 1,
        generation: v.generation ?? 0,
        executionToken,
        queueWaitSeconds: job.timestamp
          ? (startedAt - job.timestamp) / 1000
          : null,
      }),
    );
    const abort = new AbortController();
    let checking = false;
    const deadline = setTimeout(() => abort.abort(), timeout * 1000);
    const poll = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.versions
        .updateOne(
          {
            _id: v._id,
            status: 'processing',
            executionToken,
            executionExpiresAt: { $gt: new Date() },
          },
          { $set: { executionExpiresAt: new Date(Date.now() + 60000) } },
        )
        .then((result) => {
          if (!result.matchedCount) abort.abort();
        })
        .catch(() => abort.abort())
        .finally(() => {
          checking = false;
        });
    }, 1000);
    const key = `job-sources/edits/${v.userId}/${v.sourceClipId}/${String(v._id)}/${executionToken}.mp4`;
    let uploaded = false,
      completed = false;
    let directory: string | undefined;
    let phase: EditRenderPhase = EDIT_RENDER_PHASE.PREPARING;
    try {
      await this.admission.acquire(v.userId, this.admission.key(v));
      directory = await mkdtemp(
        join(tmpdir(), `blynta-edit-${String(v._id)}-${job.attemptsMade}-`),
      );
      const workspace = directory;
      await mediaExecution.run(
        { signal: abort.signal, children: new Set() },
        async () => {
          try {
            await this.plans.updateOne(
              { _id: v.planId, revision: v.revision },
              { $set: { status: 'processing' } },
            );
            let lastProgress = 0;
            let lastTick = 0;
            let writes = Promise.resolve();
            const transient = () => ({
              phase,
              encodingPercent: lastProgress,
              executionToken,
              generation: v.generation ?? 0,
              attempt: job.attemptsMade + 1,
            });
            const onPhase = async (next: EditRenderPhase) => {
              await writes;
              assertNotCancelled();
              phase = next;
              // Persist lifecycle transitions, not every encoding tick.
              const updated = await this.versions.updateOne(
                {
                  _id: v._id,
                  status: 'processing',
                  executionToken,
                  executionExpiresAt: { $gt: new Date() },
                },
                { $set: { phase, progress: lastProgress } },
              );
              if (!updated.matchedCount)
                throw new Error('Render execution lease lost');
              await job.updateProgress(transient());
            };
            const result = await this.renderer.render(
              v,
              workspace,
              (value) => {
                if (!Number.isFinite(value) || value <= lastProgress) return;
                lastProgress = Math.min(99, Math.max(0, value));
                if (Date.now() - lastTick < 500) return;
                lastTick = Date.now();
                const snapshot = transient();
                writes = writes
                  .then(() => job.updateProgress(snapshot))
                  .catch(() => {
                    abort.abort();
                  });
              },
              onPhase,
            );
            await writes;
            assertNotCancelled();
            // Mark upload intent first: even an interrupted PUT is cleaned up below.
            const intent = await this.versions.updateOne(
              {
                _id: v._id,
                status: 'processing',
                executionToken,
                executionExpiresAt: { $gt: new Date() },
              },
              { $addToSet: { pendingOutputKeys: key } },
            );
            if (!intent.modifiedCount)
              throw new Error('Render cancelled before upload');
            uploaded = true;
            await onPhase(EDIT_RENDER_PHASE.UPLOADING);
            await this.r2.uploadFile(result.outputPath, key);
            assertNotCancelled();
            const published = await this.r2.objectInfo(key);
            if (published.size !== result.bytes)
              throw new Error('Preview upload verification failed');
            await onPhase(EDIT_RENDER_PHASE.FINALIZING);
            const saved = await this.versions.updateOne(
              {
                _id: v._id,
                status: 'processing',
                executionToken,
                executionExpiresAt: { $gt: new Date() },
              },
              {
                $set: {
                  status: 'completed',
                  progress: 100,
                  phase: EDIT_RENDER_PHASE.COMPLETED,
                  outputKey: key,
                  completedAt: new Date(),
                  renderStats: {
                    duration: result.duration,
                    width: result.width,
                    height: result.height,
                    bytes: result.bytes,
                    wallSeconds: (Date.now() - startedAt) / 1000,
                  },
                },
                $pull: { pendingOutputKeys: key },
                $unset: {
                  executionToken: '',
                  executionExpiresAt: '',
                  cleanupPending: '',
                },
              },
            );
            if (!saved.modifiedCount)
              throw new Error('Render was cancelled before publication');
            completed = true;
            this.logger.log(
              JSON.stringify({
                event: 'edit_render_completed',
                versionId: String(v._id),
                executionToken,
                wallSeconds: (Date.now() - startedAt) / 1000,
                bytes: result.bytes,
              }),
            );
            await this.admission.release(v.userId, this.admission.key(v));
            await this.plans.updateOne(
              { _id: v.planId, revision: v.revision },
              { $set: { status: 'completed' } },
            );
          } finally {
            await drainMediaChildren();
          }
        },
      );
    } catch (error) {
      // A lost response from MongoDB is ambiguous; never delete durable output.
      const durable = await this.versions.findById(v._id).lean();
      if (completed || durable?.outputKey === key) return;
      if (uploaded) {
        try {
          await this.r2.deleteFile(key);
          await this.versions.updateOne(
            { _id: v._id },
            { $pull: { pendingOutputKeys: key } },
          );
        } catch (cleanupError) {
          this.logger.error(
            `Editing output cleanup deferred for ${String(v._id)}`,
            cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
          );
        }
      }
      const diagnostic = renderFailure(error, abort.signal.aborted);
      const permanent = diagnostic.permanent;
      const errorCode = diagnostic.code;
      const final =
        permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const status =
        durable?.status === 'cancelled'
          ? 'cancelled'
          : final
            ? 'failed'
            : 'queued';
      const failure = await this.versions.updateOne(
        { _id: v._id, executionToken, executionExpiresAt: { $gt: new Date() } },
        {
          $set: {
            status,
            phase:
              status === 'cancelled'
                ? EDIT_RENDER_PHASE.CANCELLED
                : status === 'queued'
                  ? EDIT_RENDER_PHASE.QUEUED
                  : EDIT_RENDER_PHASE.FAILED,
            failedPhase: phase,
            progress: 0,
            errorCode,
            failureDetails: diagnostic,
            retryable: !permanent && status !== 'cancelled',
            error:
              status === 'cancelled'
                ? 'Render cancelled'
                : abort.signal.aborted
                  ? 'Render interrupted or exceeded its time limit'
                  : 'Rendering failed; verify source media and assets',
          },
          $unset: {
            executionToken: '',
            executionExpiresAt: '',
          },
        },
      );
      if (failure.modifiedCount) {
        if (status !== 'queued')
          await this.admission.release(v.userId, this.admission.key(v));
        await this.plans.updateOne(
          { _id: v.planId, revision: v.revision },
          { $set: { status } },
        );
      }
      this.logger.error(
        JSON.stringify({
          event: 'edit_render_failed',
          versionId: String(v._id),
          executionToken,
          revision: v.revision,
          attempt: job.attemptsMade + 1,
          errorCode,
          failedPhase: phase,
          failure: diagnostic,
          operations: v.plan.operations
            .filter((operation) => operation.enabled)
            .map((operation) => operation.type),
          retryable: !permanent,
          wallSeconds: (Date.now() - startedAt) / 1000,
        }),
      );
      if (status === 'cancelled') return;
      if (permanent)
        throw new UnrecoverableError(
          errorCode === 'EDIT_VALIDATION'
            ? 'Edit plan or asset validation failed'
            : 'Editing failed permanently; inspect the safe render diagnostic',
        );
      throw error;
    } finally {
      clearTimeout(deadline);
      clearInterval(poll);
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
}

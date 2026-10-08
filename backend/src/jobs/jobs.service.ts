import { hostname } from 'node:os';
import { CreditsService } from '../billing/credits.service';
import { clipPrice, eligibleClipPrice } from '../billing/credit-pricing';
import { randomUUID } from 'node:crypto';
import { mediaExecution, ProcessingCancelled } from './cancellation-context';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Model, Types, ClientSession } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import {
  Job,
  JobDocument,
  JobStatus,
  Clip,
  ClipProcessingState,
} from './schemas/job.schema';
import { HighlightDto } from '../media/services/highlight-detection.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobAccessDeniedException } from '../common/exceptions';
import { UsersService } from '../users/users.service';
import {
  JOBS_QUEUE,
  JOBS_TYPES,
  RENDER_QUEUE,
  RENDER_CLIP,
  MEDIA_JOB_OPTIONS,
  pipelineJobId,
  renderJobId,
} from './jobs.constants';
import { clipIdentity } from './clip-identity';
import {
  renderSnapshot,
  ClipRenderProgress,
  clipOverallValue,
} from './render-progress';
import { RenderEtaService } from './render-eta.service';
import { STYLE_PRESETS } from '../media/style-presets';
import type { RenderEtaEntry } from './render-eta';
import { R2Service } from '../storage/r2.service';
import type { StudioAsset } from '../studio/studio.schemas';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue(JOBS_QUEUE) private jobsQueue: Queue,
    @InjectQueue(RENDER_QUEUE) private renderQueue: Queue,
    private usersService: UsersService,
    private configService: ConfigService,
    private r2Service: R2Service,
    private activitiesService: ActivitiesService,
    private renderEta: RenderEtaService,
    @Optional()
    @InjectModel('StudioAsset')
    private studioAssets?: Model<StudioAsset>,
    @Optional() private credits?: CreditsService,
  ) {}

  async cancelJob(userId: string, jobId: string) {
    const current = await this.getJobById(userId, jobId);
    const unconfirmedCompletion =
      current.status === JobStatus.COMPLETED &&
      Boolean(current.activeExecutions?.length);
    await this.jobModel
      .updateOne(
        {
          _id: jobId,
          deletionRequested: { $ne: true },
          cancellationRequestedAt: null,
          status: { $nin: [JobStatus.COMPLETED, JobStatus.CANCELLED] },
          ...(unconfirmedCompletion
            ? {
                status: JobStatus.COMPLETED,
                'activeExecutions.0': { $exists: true },
              }
            : {}),
        },
        {
          $set: {
            status: JobStatus.CANCELLING,
            cancellationRequestedAt: new Date(),
            pipelineRetryRequested: false,
            renderRetryRequested: false,
            'clips.$[].retryRequested': false,
          },
        },
      )
      .exec();
    await this.finalizeCancellation(jobId).catch((error) =>
      this.logger.warn(`Cancellation remains pending: ${error}`),
    );
    const latest = await this.getJobById(userId, jobId);
    if (latest.deletionRequested)
      throw new ConflictException('Video deletion is already underway.');
    return latest;
  }

  async finalizeCancellation(jobId: string) {
    const parent = await this.findJob(jobId);
    if (
      parent?.status !== JobStatus.CANCELLING ||
      parent.activeExecutions?.length
    )
      return;
    // Also fence legacy work and processors still returning from cleanup.
    if ((await this.activeMediaJobIds()).has(jobId)) return;
    if (!(await this.removeInactiveMediaJobs(jobId))) return;
    const total = parent.clips.reduce(
      (sum, c) => sum + Math.max(0.001, c.endTime - c.startTime),
      0,
    );
    const ready = parent.clips
      .filter((c) => c.status === JobStatus.COMPLETED)
      .reduce((sum, c) => sum + Math.max(0.001, c.endTime - c.startTime), 0);
    await this.jobModel
      .updateOne(
        {
          _id: jobId,
          status: JobStatus.CANCELLING,
          $or: [
            { activeExecutions: { $size: 0 } },
            { activeExecutions: { $exists: false } },
          ],
        },
        {
          $set: {
            status: JobStatus.CANCELLED,
            cancelledAt: new Date(),
            progressPercent: total ? Math.floor((100 * ready) / total) : 0,
            'clips.$[unfinished].status': JobStatus.CANCELLED,
            'clips.$[unfinished].processingState':
              ClipProcessingState.CANCELLED,
            'clips.$[unfinished].retryRequested': false,
          },
          $unset: { errorMessage: '', errorStage: '' },
        },
        {
          arrayFilters: [
            {
              'unfinished.status': {
                $nin: [JobStatus.COMPLETED, JobStatus.FAILED],
              },
            },
          ],
        },
      )
      .exec();
  }

  /** Mongo claim serializes start against cancellation and deletion across all hosts. */
  async runMediaExecution(jobId: string, work: () => Promise<void>) {
    const token = `${hostname()}/${process.pid}/${randomUUID()}`;
    const claimed = await this.jobModel
      .findOneAndUpdate(
        {
          _id: jobId,
          cancellationRequestedAt: null,
          deletionRequested: { $ne: true },
        },
        {
          $addToSet: {
            activeExecutions: token,
            mediaExecutionLeases: {
              token,
              expiresAt: new Date(Date.now() + 120_000),
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!claimed) return;
    const controller = new AbortController();
    const context = {
      signal: controller.signal,
      children: new Set<Promise<void>>(),
    };
    let checking = false;
    let lastHeartbeat = 0;
    const poll = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.findJob(jobId)
        .then((parent) => {
          if (
            !parent ||
            parent.cancellationRequestedAt ||
            !parent.activeExecutions?.includes(token)
          )
            controller.abort();
          if (Date.now() - lastHeartbeat > 10_000) {
            lastHeartbeat = Date.now();
            return this.jobModel
              .updateOne(
                { _id: jobId, 'mediaExecutionLeases.token': token },
                {
                  $set: {
                    'mediaExecutionLeases.$.expiresAt': new Date(
                      Date.now() + 120_000,
                    ),
                  },
                },
              )
              .exec();
          }
        })
        .catch(() => controller.abort())
        .finally(() => {
          checking = false;
        });
    }, 500);
    try {
      if (claimed.creditOperationId && this.credits) {
        await this.credits.capture(claimed.creditOperationId, token, () =>
          mediaExecution.run(context, work),
        );
        const latest = await this.findJob(jobId);
        await this.credits.record(claimed.creditOperationId, token, 'media', {
          source: latest?.mediaMetadata,
          sourceSeconds: latest?.videoDuration,
          outputs: latest?.clips
            .filter((c) => c.status === JobStatus.COMPLETED)
            .map((c) => ({
              clipId: String(c._id),
              duration: c.endTime - c.startTime,
              storageKey: c.r2ObjectKey,
              resolution: latest.resolutionUsed,
              codec: 'h264',
            })),
        });
      } else await mediaExecution.run(context, work);
    } catch (error) {
      const parent = await this.findJob(jobId);
      if (!parent?.cancellationRequestedAt) throw error;
      // Return normally to BullMQ: intentional cancellation has no automatic retry.
    } finally {
      clearInterval(poll);
      controller.abort();
      await Promise.all([...context.children]);
      await this.jobModel
        .updateOne(
          { _id: jobId },
          {
            $pull: { activeExecutions: token, mediaExecutionLeases: { token } },
          },
        )
        .exec();
      await this.finalizeCredits(jobId);
    }
  }

  async createJob(userId: string, dto: CreateJobDto): Promise<JobDocument> {
    let operationId: string | undefined;
    let relatedId: string | undefined;
    if (this.credits?.enabled) {
      if (
        !dto.operationId ||
        !dto.sourceSeconds ||
        !dto.maxOutputSeconds ||
        !dto.authorizedCredits
      )
        throw new ConflictException(
          'Confirm a source duration limit and output budget before starting',
        );
      const pricing = this.credits.pricing();
      if (dto.pricingVersion !== pricing.version)
        throw new ConflictException(
          'Pricing changed. Review your estimate again.',
        );
      const amount = clipPrice(
        dto.sourceSeconds,
        dto.maxOutputSeconds,
        pricing,
      ).totalCredits;
      if (amount !== dto.authorizedCredits)
        throw new ConflictException('Review the current credit estimate');
      const user = await this.usersService.findById(userId);
      if (!user || !user.isActive)
        throw new ConflictException('Account is not active');
      if (
        user.plan === 'free' &&
        (dto.customPrompt ||
          (dto.aiModel && dto.aiModel !== 'default') ||
          STYLE_PRESETS[dto.stylePreset || 'default']?.isPro)
      )
        throw new ConflictException(
          'Advanced clip options require a paid plan',
        );
      operationId = `clips-${userId}-${dto.operationId}`;
      const op = await this.credits.reserve({
        userId,
        operationId,
        product: 'ai-clips',
        relatedId: new Types.ObjectId().toString(),
        sourceSeconds: dto.sourceSeconds,
        maxOutputSeconds: dto.maxOutputSeconds,
        amount,
        pricing,
        fingerprint: JSON.stringify([
          dto.sourceUrl,
          dto.sourceSeconds,
          dto.maxOutputSeconds,
          dto.customPrompt,
          dto.aiModel,
          dto.stylePreset,
          pricing.version,
        ]),
      });
      relatedId = op.relatedId;
      const existing = await this.findJob(relatedId);
      if (existing) return existing;
      if (op.status !== 'reserved')
        throw new ConflictException(
          'This operation has ended. Submit a new authorization.',
        );
    } else {
      await this.usersService.deductCredit(userId);
    }

    const job = new this.jobModel({
      ...(relatedId ? { _id: new Types.ObjectId(relatedId) } : {}),
      creditOperationId: operationId,
      creditSourceSeconds: dto.sourceSeconds,
      creditOutputSeconds: dto.maxOutputSeconds,
      userId: new Types.ObjectId(userId),
      sourceUrl: dto.sourceUrl,
      sourcePlatform: dto.sourcePlatform,
      status: JobStatus.PENDING,
      customPrompt: dto.customPrompt,
      aiModel: dto.aiModel,
      stylePreset: dto.stylePreset || 'default',
      resolutionUsed: dto.resolution,
      progressPercent: 0,
      pipelineRetryRequested: true,
    });
    let saved: JobDocument;
    try {
      saved = await job.save();
    } catch (error) {
      if ((error as { code?: number }).code === 11000 && relatedId) {
        const existing = await this.findJob(relatedId);
        if (existing) return existing;
      }
      // Durable reservations without a parent are recovered by reconciliation.
      throw error;
    }

    try {
      await this.enqueuePipeline(saved._id.toString());
    } catch (error) {
      if (!operationId) throw error;
      this.logger.warn({
        event: 'billing.dispatch.pending',
        jobId: String(saved._id),
        error: String(error),
      });
      // pipelineRetryRequested is a durable outbox intent; worker reconciliation re-enqueues.
    }

    // Activities for Job Creation and Credit Usage
    await this.activitiesService.queueCreate({
      userId: saved.userId,
      type: ActivityType.JOB_CREATE,
      dedupeKey: `activity:job:${saved._id.toString()}:create`,
      category: ActivityCategory.JOB,
      title: 'Clip generation started',
      description: 'Your video is being processed.',
      activityUrl: `/dashboard/jobs/${saved._id.toString()}`,
      entityType: 'job',
      entityId: saved._id,
      actorType: ActivityActorType.USER,
      actorId: saved.userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: {
        sourcePlatform: dto.sourcePlatform,
        aiModel: dto.aiModel,
        stylePreset: dto.stylePreset || 'default',
      },
    });

    if (!operationId)
      await this.activitiesService.queueCreate({
        userId: saved.userId,
        type: ActivityType.CREDIT_DEDUCT,
        dedupeKey: `activity:job:${saved._id.toString()}:credit-deduct`,
        category: ActivityCategory.CREDIT,
        title: 'Credit used',
        description: '1 credit used for video clip generation.',
        activityUrl: '/billing',
        entityType: 'job',
        entityId: saved._id,
        actorType: ActivityActorType.USER,
        actorId: saved.userId,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.INFO,
        metadata: {
          amount: 1,
          jobId: saved._id.toString(),
        },
      });

    return saved;
  }

  async getJobById(userId: string, jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId.toString() !== userId) {
      throw new JobAccessDeniedException();
    }
    return job;
  }

  // Task 1 — paginated + filterable job list
  async getJobsForUser(
    userId: string,
    options?: { status?: JobStatus; page?: number; limit?: number },
  ): Promise<{
    jobs: JobDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (options?.status) filter.status = options.status;

    const [jobs, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.jobModel.countDocuments(filter).exec(),
    ]);

    return { jobs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateJob(
    jobId: string,
    updates: Partial<Job>,
  ): Promise<JobDocument | null> {
    const result = await this.jobModel
      .findOneAndUpdate(
        {
          _id: jobId,
          cancellationRequestedAt: null,
          deletionRequested: { $ne: true },
        },
        updates,
        { returnDocument: 'after' },
      )
      .exec();
    if (!result && mediaExecution.getStore()) throw new ProcessingCancelled();
    if (
      result &&
      [JobStatus.FAILED, JobStatus.COMPLETED].includes(result.status)
    )
      await this.finalizeCredits(jobId);
    return result;
  }

  async findJob(jobId: string): Promise<JobDocument | null> {
    return this.jobModel.findById(jobId).exec();
  }

  private async removeInactiveMediaJobs(jobId: string) {
    for (const queue of [this.jobsQueue, this.renderQueue]) {
      const entries = await queue.getJobs([
        'active',
        'waiting',
        'delayed',
        'prioritized',
        'completed',
        'failed',
        'waiting-children',
      ]);
      for (const entry of entries) {
        if ((entry.data as { jobId?: string }).jobId !== jobId) continue;
        if ((await entry.getState()) === 'active') return false;
        // BullMQ remove is atomic and rejects if the worker acquired a lock meanwhile.
        try {
          await entry.remove();
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  async activeMediaJobIds() {
    const active = await Promise.all([
      this.jobsQueue.getJobs(['active']),
      this.renderQueue.getJobs(['active']),
    ]);
    return new Set(
      active.flat().map((job) => (job.data as { jobId?: string }).jobId),
    );
  }

  private async dispatchMediaJobs(
    jobId: string,
    dispatch: () => Promise<void>,
  ) {
    const token = `dispatch/${hostname()}/${process.pid}/${randomUUID()}`;
    const claimed = await this.jobModel
      .updateOne(
        {
          _id: jobId,
          cancellationRequestedAt: null,
          deletionRequested: { $ne: true },
        },
        {
          $addToSet: {
            activeExecutions: token,
            mediaExecutionLeases: {
              token,
              expiresAt: new Date(Date.now() + 120_000),
            },
          },
        },
      )
      .exec();
    if (claimed.matchedCount === 0) return;
    try {
      await dispatch();
    } finally {
      await this.jobModel
        .updateOne(
          { _id: jobId },
          {
            $pull: { activeExecutions: token, mediaExecutionLeases: { token } },
          },
        )
        .exec();
    }
  }

  async enqueuePipeline(jobId: string) {
    await this.dispatchMediaJobs(jobId, () => this.dispatchPipeline(jobId));
  }

  private async dispatchPipeline(jobId: string) {
    const parent = await this.findJob(jobId);
    if (
      !parent ||
      parent.cancellationRequestedAt ||
      parent.deletionRequested ||
      parent.renderManifestReady
    )
      return;
    const queued = await this.jobsQueue.getJob(pipelineJobId(jobId));
    if (!queued)
      await this.jobsQueue.add(
        JOBS_TYPES.CLIP_VIDEO,
        { jobId },
        { ...MEDIA_JOB_OPTIONS, jobId: pipelineJobId(jobId) },
      );
    else if (parent.pipelineRetryRequested) {
      const state = await queued.getState();
      if (state === 'failed' || state === 'completed')
        await queued.retry(state, { resetAttemptsMade: true });
    }
    await this.jobModel
      .updateOne({ _id: jobId }, { $set: { pipelineRetryRequested: false } })
      .exec();
  }

  async prepareRenderManifest(jobId: string, highlights: HighlightDto[]) {
    const job = await this.findJob(jobId);
    if (
      !job ||
      job.cancellationRequestedAt ||
      job.deletionRequested ||
      job.renderManifestReady
    )
      return;
    if (job.creditOperationId) {
      let remaining = job.creditOutputSeconds || 0;
      highlights = highlights.flatMap((h) => {
        const duration = h.endTime - h.startTime;
        if (
          !Number.isFinite(duration) ||
          duration <= 0 ||
          h.startTime < 0 ||
          h.endTime > (job.videoDuration || 0)
        )
          return [];
        if (duration > remaining) return [];
        remaining -= duration;
        return [h];
      });
    }
    const baseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'http://localhost:5001',
    );
    const clips = highlights.map((highlight, index) => {
      const existing = job.clips[index];
      const id = clipIdentity(existing, highlight);
      if (
        existing?._id.equals(id) &&
        existing.status === JobStatus.COMPLETED &&
        existing.r2ObjectKey
      )
        return existing;
      return {
        _id: id,
        startTime: highlight.startTime,
        endTime: highlight.endTime,
        downloadUrl: `${baseUrl}/jobs/${jobId}/clips/${id.toString()}/download`,
        status: JobStatus.PENDING,
        processingState: ClipProcessingState.QUEUED,
        hasCaptions: false,
      };
    });
    // Manifest precedes fan-out; a retry reads the winner rather than creating new IDs.
    await this.jobModel
      .updateOne(
        {
          _id: jobId,
          cancellationRequestedAt: null,
          deletionRequested: { $ne: true },
          renderManifestReady: { $ne: true },
        },
        {
          $set: {
            clips,
            renderManifestReady: true,
            status: JobStatus.CUTTING_CLIPS,
            progressPercent: 0,
          },
          $unset: { errorMessage: '', errorStage: '' },
        },
      )
      .exec();
  }

  async enqueueRenders(jobId: string, retryFailed = false) {
    await this.dispatchMediaJobs(jobId, () =>
      this.dispatchRenders(jobId, retryFailed),
    );
  }

  private async dispatchRenders(jobId: string, retryFailed = false) {
    const job = await this.findJob(jobId);
    if (
      !job?.renderManifestReady ||
      !job.sourceObjectKey ||
      job.cancellationRequestedAt ||
      job.deletionRequested
    )
      return;
    retryFailed = retryFailed || !!job.renderRetryRequested;
    for (const [index, clip] of job.clips.entries()) {
      if ((await this.findJob(jobId))?.cancellationRequestedAt) return;
      if (clip.status === JobStatus.COMPLETED) continue;
      if (clip.status === JobStatus.FAILED && !retryFailed) continue;
      if (clip.retryRequested) {
        await this.enqueueClipRetry(jobId, clip, index);
        continue;
      }
      const id = renderJobId(jobId, clip._id.toString());
      const queued = await this.renderQueue.getJob(id);
      if (queued) {
        const state = await queued.getState();
        if (retryFailed && (state === 'failed' || state === 'completed'))
          await queued.retry(state, { resetAttemptsMade: true });
        // A crash between Mongo update and Bull completion is recovered by reconciliation.
        continue;
      }
      await this.renderQueue.add(
        RENDER_CLIP,
        { jobId, clipId: clip._id.toString() },
        {
          ...MEDIA_JOB_OPTIONS,
          jobId: id,
          priority: index + 1,
        },
      );
    }
    if (retryFailed)
      await this.jobModel
        .updateOne({ _id: jobId }, { $set: { renderRetryRequested: false } })
        .exec();
  }

  async updateClip(jobId: string, clipId: string, updates: Partial<Clip>) {
    const fields = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [`clips.$.${key}`, value]),
    );
    const result = await this.jobModel
      .updateOne(
        {
          _id: jobId,
          ...(updates.status === JobStatus.COMPLETED
            ? {}
            : { cancellationRequestedAt: null }),
          deletionRequested: { $ne: true },
          'clips._id': new Types.ObjectId(clipId),
        },
        { $set: fields },
      )
      .exec();
    if (result.matchedCount === 0 && mediaExecution.getStore())
      throw new ProcessingCancelled();
    return result;
  }

  async failUnfinishedClip(
    jobId: string,
    clipId: string,
    message: string,
    stage: string,
    retryCount?: number,
  ) {
    // Reconciliation reads a snapshot: a worker may finish before this update executes.
    return this.jobModel
      .updateOne(
        {
          _id: jobId,
          cancellationRequestedAt: null,
          deletionRequested: { $ne: true },
          clips: {
            $elemMatch: {
              _id: new Types.ObjectId(clipId),
              status: { $ne: JobStatus.COMPLETED },
              retryRequested: { $ne: true },
              retryCount: retryCount || { $in: [null, 0] },
            },
          },
        },
        {
          $set: {
            'clips.$.status': JobStatus.FAILED,
            'clips.$.processingState': ClipProcessingState.FAILED,
            'clips.$.errorMessage': message,
            'clips.$.errorStage': stage,
            'clips.$.failedAt': new Date(),
          },
        },
      )
      .exec();
  }

  async finalizeRenderState(jobId: string) {
    const job = await this.findJob(jobId);
    if (!job?.renderManifestReady || job.status !== JobStatus.CUTTING_CLIPS)
      return;
    if (
      job.clips.some(
        (c) => ![JobStatus.COMPLETED, JobStatus.FAILED].includes(c.status),
      )
    )
      return;
    const failed = job.clips.filter(
      (c) => c.status === JobStatus.FAILED,
    ).length;
    const success = job.clips.length > 0 && failed === 0;
    const finalized = await this.jobModel
      .findOneAndUpdate(
        {
          _id: jobId,
          status: JobStatus.CUTTING_CLIPS,
          cancellationRequestedAt: null,
          updatedAt: job.updatedAt,
          clips: {
            $not: {
              $elemMatch: {
                status: { $nin: [JobStatus.COMPLETED, JobStatus.FAILED] },
              },
            },
          },
        },
        {
          $set: {
            status: success ? JobStatus.COMPLETED : JobStatus.FAILED,
            progressPercent: 100,
            completionPublished: false,
            ...(success
              ? {}
              : {
                  errorMessage: job.clips.length
                    ? `${failed} of ${job.clips.length} clips failed; ready clips remain available.`
                    : 'No highlights found',
                  errorStage: 'rendering',
                }),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (finalized) await this.finalizeCredits(jobId);
    return finalized;
  }

  async finalizeCredits(jobId: string) {
    const job = await this.findJob(jobId);
    if (
      !job?.creditOperationId ||
      !this.credits ||
      job.activeExecutions?.length ||
      ![JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
        job.status,
      )
    )
      return;
    const op = await this.credits.operations.findOne({
      operationId: job.creditOperationId,
    });
    if (!op || op.status === 'settled') return;
    const outputs = new Map(
      (op.deliveredOutputs || []).map((o) => [o.id, o.seconds]),
    );
    for (const c of job.clips.filter(
      (c) => c.status === JobStatus.COMPLETED && c.r2ObjectKey,
    ))
      outputs.set(String(c._id), Math.max(0, c.endTime - c.startTime));
    const delivered = [...outputs.values()].reduce(
      (n, seconds) => n + seconds,
      0,
    );
    await this.credits.settle(
      op.operationId,
      Math.max(
        op.charged,
        eligibleClipPrice(job.videoDuration || 0, delivered, op.pricing),
      ),
      [...outputs].map(([id, seconds]) => ({ id, seconds })),
    );
  }

  async assertSourceBudget(jobId: string, duration: number) {
    const job = await this.findJob(jobId);
    if (job?.creditOperationId)
      await this.credits!.assertSourceBudget(job.creditOperationId, duration);
  }
  async recoverExecutionLeases(jobId: string) {
    if ((await this.activeMediaJobIds()).has(jobId)) return;
    const job = await this.findJob(jobId);
    for (const lease of job?.mediaExecutionLeases || []) {
      if (new Date(lease.expiresAt).getTime() >= Date.now()) continue;
      await this.jobModel
        .updateOne(
          {
            _id: jobId,
            mediaExecutionLeases: {
              $elemMatch: {
                token: lease.token,
                expiresAt: { $lt: new Date() },
              },
            },
          },
          {
            $pull: {
              activeExecutions: lease.token,
              mediaExecutionLeases: { token: lease.token },
            },
          },
        )
        .exec();
      this.logger.warn({ event: 'billing.execution.lease-recovered', jobId });
    }
  }

  async markCompletionPublished(jobId: string, status: JobStatus) {
    await this.jobModel
      .updateOne(
        { _id: jobId, status },
        { $set: { completionPublished: true } },
      )
      .exec();
  }

  async getRenderSnapshot(job: JobDocument) {
    const progress: RenderEtaEntry[] = await Promise.all(
      job.clips.map(async (clip) => {
        const hasCaptions =
          job.transcript?.some(
            (segment) =>
              segment.endTime > clip.startTime &&
              segment.startTime < clip.endTime,
          ) ?? clip.hasCaptions;
        if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(clip.status))
          return { clip, hasCaptions, progress: undefined };
        const bullJob = await this.renderQueue.getJob(
          renderJobId(job._id.toString(), clip._id.toString()),
        );
        const state = bullJob ? await bullJob.getState() : undefined;
        const sample =
          typeof bullJob?.progress === 'object'
            ? (bullJob.progress as ClipRenderProgress)
            : undefined;
        const fresh =
          sample &&
          (!clip.retryQueuedAt ||
            sample.updatedAt >= new Date(clip.retryQueuedAt).getTime())
            ? sample
            : undefined;
        // Retain overall progress across retries, but discard stale stage ETA/time.
        return {
          clip,
          hasCaptions,
          queueState: state,
          progress:
            state === 'active' && fresh
              ? fresh
              : ['waiting', 'prioritized', 'delayed'].includes(state ?? '')
                ? {
                    clipId: clip._id.toString(),
                    status: ClipProcessingState.QUEUED,
                    progress: fresh ? clipOverallValue(fresh) : 0,
                    renderProgress: 0,
                    stageProgress: 0,
                    updatedAt: Date.now(),
                  }
                : undefined,
        };
      }),
    );
    if (job.cancellationRequestedAt) {
      const snapshot = renderSnapshot(
        progress.map((entry) => ({ ...entry, progress: undefined })),
      );
      const total = job.clips.reduce(
        (sum, c) => sum + Math.max(0.001, c.endTime - c.startTime),
        0,
      );
      const ready = job.clips
        .filter((c) => c.status === JobStatus.COMPLETED)
        .reduce((sum, c) => sum + Math.max(0.001, c.endTime - c.startTime), 0);
      return {
        ...snapshot,
        progressPercent: total ? Math.floor((100 * ready) / total) : 0,
        estimatedRemainingSeconds: null,
      };
    }
    const estimatedRemainingSeconds = await this.renderEta.estimate(
      job._id.toString(),
      job.status,
      progress,
    );
    return { ...renderSnapshot(progress), estimatedRemainingSeconds };
  }

  async reconcileMediaJobs() {
    const jobs = await this.jobModel
      .find({
        $or: [
          {
            status: {
              $in: [
                JobStatus.CANCELLING,
                JobStatus.PENDING,
                JobStatus.TRANSCRIBING,
                JobStatus.DETECTING_HIGHLIGHTS,
                JobStatus.CUTTING_CLIPS,
              ],
            },
          },
          {
            completionPublished: false,
            status: { $in: [JobStatus.COMPLETED, JobStatus.FAILED] },
          },
        ],
      })
      .exec();
    for (const job of jobs) {
      const jobId = job._id.toString();
      if (job.cancellationRequestedAt) {
        await this.finalizeCancellation(jobId);
        continue;
      }
      if (job.renderManifestReady && job.status === JobStatus.CUTTING_CLIPS) {
        await this.enqueueRenders(jobId);
        for (const clip of job.clips) {
          if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(clip.status))
            continue;
          const queued = await this.renderQueue.getJob(
            renderJobId(jobId, clip._id.toString()),
          );
          const state = queued && (await queued.getState());
          if (state === 'failed')
            await this.failUnfinishedClip(
              jobId,
              clip._id.toString(),
              queued!.failedReason,
              clip.errorStage || 'worker',
              clip.retryCount,
            );
          else if (state === 'completed') {
            // Completed Bull job without durable output is inconsistent, fail explicitly.
            await this.failUnfinishedClip(
              jobId,
              clip._id.toString(),
              'Render finished without durable output',
              'worker',
              clip.retryCount,
            );
          }
        }
        await this.finalizeRenderState(jobId);
      } else if (
        ![JobStatus.COMPLETED, JobStatus.FAILED].includes(job.status)
      ) {
        if (job.pipelineRetryRequested) await this.enqueuePipeline(jobId);
        const queued = await this.jobsQueue.getJob(pipelineJobId(jobId));
        const state = queued && (await queued.getState());
        if (state === 'failed')
          await this.updateJob(jobId, {
            status: JobStatus.FAILED,
            errorMessage: queued!.failedReason,
            errorStage: 'worker',
          });
        // Keep legacy numeric jobs safe while draining pre-migration work.
        if (
          !queued &&
          Date.now() - new Date(job.updatedAt).getTime() > 30 * 60 * 1000
        ) {
          const legacyJobs = await this.jobsQueue.getJobs([
            'active',
            'waiting',
            'delayed',
            'prioritized',
          ]);
          if (
            !legacyJobs.some(
              (q) => (q.data as { jobId?: string }).jobId === jobId,
            )
          )
            await this.updateJob(jobId, {
              status: JobStatus.FAILED,
              errorMessage: 'No live pipeline job found',
              errorStage: 'reconciliation',
            });
        }
      }
    }
    return jobs.map((job) => job._id.toString());
  }

  async findStuckJobs(
    statuses: JobStatus[],
    cutoff: Date,
  ): Promise<JobDocument[]> {
    return this.jobModel
      .find({
        status: { $in: statuses },
        updatedAt: { $lt: cutoff },
      })
      .exec();
  }

  async getClipForDownload(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ clip: Clip }> {
    const job = await this.getJobById(userId, jobId);
    const clip = job.clips.find((c) => c._id.toString() === clipId);
    if (!clip) throw new NotFoundException('Clip not found');
    // clip.r2ObjectKey is the R2 object key for the captioned (or raw) clip.
    // The controller depends on this field being present to call r2Service.getSignedDownloadUrl().
    if (!clip.r2ObjectKey) throw new NotFoundException('Clip file not ready');
    return { clip };
  }

  // Task 2 — delete an entire job + its clips from R2
  async deleteJob(userId: string, jobId: string): Promise<{ message: string }> {
    const job = await this.getJobById(userId, jobId); // ownership check + NotFoundException
    await this.finalizeCredits(jobId);

    const activeStatuses: JobStatus[] = [
      JobStatus.CANCELLING,
      JobStatus.PENDING,
      JobStatus.TRANSCRIBING,
      JobStatus.DETECTING_HIGHLIGHTS,
      JobStatus.CUTTING_CLIPS,
    ];
    if (activeStatuses.includes(job.status)) {
      throw new ConflictException(
        'Cannot delete a job that is still processing',
      );
    }

    const claimed = await this.jobModel
      .findOneAndUpdate(
        {
          _id: jobId,
          status: job.status,
          $or: [
            { activeExecutions: { $size: 0 } },
            { activeExecutions: { $exists: false } },
          ],
          deletionRequested: { $ne: true },
        },
        { $set: { deletionRequested: true } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!claimed && !job.deletionRequested)
      throw new ConflictException(
        'Workers are still stopping. Please try again shortly.',
      );
    if ((await this.activeMediaJobIds()).has(jobId))
      throw new ConflictException(
        'Workers are still stopping. Please try again shortly.',
      );

    if (!(await this.removeInactiveMediaJobs(jobId)))
      throw new ConflictException(
        'Workers are still stopping. Please try again shortly.',
      );

    // Local disk cleanup:
    // For COMPLETED jobs the local temp directory was already cleaned up at the
    // end of JobsProcessor.processClipVideoJob() (finally block, success path).
    // For FAILED jobs the dir is intentionally kept so that a retry can resume
    // from existing local files. Attempting fs.rm here with force:true is still
    // correct for both cases: it's a no-op for completed jobs (dir already gone)
    // and it ensures the dir is cleaned for FAILED jobs that are being deleted
    // without ever being retried — avoiding a permanent disk leak.
    // For active jobs we already throw ConflictException above, so we won't reach here.
    if (!activeStatuses.includes(job.status)) {
      const storageRoot = this.configService.get<string>(
        'STORAGE_ROOT',
        '/var/blynta/storage',
      );
      const jobDir = path.join(storageRoot, 'jobs', jobId);
      try {
        // Expected behaviour: directory won't exist for completed/failed jobs since
        // the processor's finally block already removed it. force:true makes this a no-op
        // rather than an error, which is correct and intentional.
        await fs.promises.rm(jobDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(
          `Failed to delete job directory ${jobDir}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Delete each clip's R2 object.
    // IMPORTANT: We do NOT delete the SourceVideo record or its associated
    // source-videos/<externalId>/... R2 objects, even if this job was the last one
    // referencing them. SourceVideo entries are shared across jobs and users;
    // per-job deletion must never cascade to the shared cache. SourceVideo-level
    // R2 cleanup is a separate future concern (background cron by referenceCount/age).
    for (const clip of job.clips) {
      const objectKey =
        clip.r2ObjectKey ||
        `clips/${jobId}/${clip._id.toString()}-captioned.mp4`;
      if (objectKey) {
        try {
          if (!(await this.studioAssets?.exists({ storageKey: objectKey })))
            await this.r2Service.deleteFile(objectKey);
        } catch {
          throw new ServiceUnavailableException(
            'Media deletion is pending. Please try deleting again.',
          );
        }
      }
    }

    // A source upload may have finished just before its Mongo commit was cancelled.
    await this.r2Service.deleteFile(
      job.sourceObjectKey?.startsWith(`job-sources/${jobId}/`)
        ? job.sourceObjectKey
        : `job-sources/${jobId}/video.mp4`,
    );
    await this.jobModel.findByIdAndDelete(jobId).exec();

    await this.activitiesService.queueCreate({
      userId: job.userId,
      type: ActivityType.JOB_DELETE,
      dedupeKey: `activity:job:${jobId}:delete`,
      category: ActivityCategory.JOB,
      title: 'Job deleted',
      description: 'Video processing job was deleted.',
      activityUrl: '/dashboard',
      entityType: 'job',
      entityId: job._id,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { message: 'Job deleted successfully' };
  }

  // Task 3 — delete a single clip within a job
  async deleteClip(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ message: string }> {
    const job = await this.getJobById(userId, jobId);
    await this.finalizeCredits(jobId);
    if (
      ![JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
        job.status,
      ) ||
      job.deletionRequested ||
      job.activeExecutions?.length
    )
      throw new ConflictException(
        'Cannot delete clips while the job is processing',
      );
    if ((await this.activeMediaJobIds()).has(jobId))
      throw new ConflictException(
        'Workers are still stopping. Please try again shortly.',
      );
    const clip = job.clips.find((c) => c._id.toString() === clipId);
    if (!clip) throw new NotFoundException('Clip not found');

    // Delete the clip's R2 object. Local file paths (localFilePath, captionedFilePath)
    // are no longer the source of truth — they were temp working copies cleaned up
    // by the processor's finally block after the job completed.
    if (clip.r2ObjectKey) {
      try {
        if (
          !(await this.studioAssets?.exists({ storageKey: clip.r2ObjectKey }))
        )
          await this.r2Service.deleteFile(clip.r2ObjectKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete R2 object ${clip.r2ObjectKey}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await this.jobModel
      .updateOne(
        { _id: jobId },
        { $pull: { clips: { _id: new Types.ObjectId(clipId) } } },
      )
      .exec();

    await this.activitiesService.queueCreate({
      userId: job.userId,
      type: ActivityType.CLIP_DELETE,
      dedupeKey: `activity:job:${jobId}:clip:${clipId}:delete`,
      category: ActivityCategory.JOB,
      title: 'Clip deleted',
      description: 'Clip was removed from job.',
      activityUrl: `/dashboard/jobs/${jobId}`,
      entityType: 'clip',
      entityId: clipId,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: { jobId, clipId },
    });

    return { message: 'Clip deleted successfully' };
  }

  // Resume-in-place retry — re-enqueues the SAME job instead of creating a new one.
  // V2 reserves the remaining original authorization; delivered work is charged cumulatively.
  // Only resets terminal error fields; leaves localVideoPath, transcript,
  // highlights, and clips intact so the processor can detect which stages
  // are already complete and skip straight past them.
  async retryJob(
    userId: string,
    jobId: string,
  ): Promise<{ jobId: string; status: string }> {
    await this.getJobById(userId, jobId); // ownership check + NotFoundException
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.FAILED) {
      throw new ConflictException('Only failed jobs can be retried');
    }

    // Claim the retry once; concurrent API calls cannot enqueue duplicate attempts.
    const claim = async (session: ClientSession | null = null) =>
      this.jobModel
        .findOneAndUpdate(
          {
            _id: jobId,
            status: JobStatus.FAILED,
            cancellationRequestedAt: null,
            deletionRequested: { $ne: true },
          },
          {
            $set: {
              status: job.renderManifestReady
                ? JobStatus.CUTTING_CLIPS
                : JobStatus.PENDING,
              completionPublished: false,
              pipelineRetryRequested: !job.renderManifestReady,
              ...(job.renderManifestReady
                ? {
                    renderRetryRequested: true,
                    'clips.$[failed].status': JobStatus.PENDING,
                    'clips.$[failed].processingState':
                      ClipProcessingState.QUEUED,
                    'clips.$[failed].errorMessage': '',
                    'clips.$[failed].errorStage': '',
                  }
                : {}),
            },
            $unset: { errorMessage: '', errorStage: '' },
          },
          {
            returnDocument: 'after',
            ...(job.renderManifestReady
              ? { arrayFilters: [{ 'failed.status': JobStatus.FAILED }] }
              : {}),
          },
        )
        .session(session)
        .exec();
    const activate = async (session: ClientSession | null = null) => {
      const result = await claim(session);
      if (!result) throw new ConflictException('Job retry already started');
      return result;
    };
    const claimed = job.creditOperationId
      ? await this.credits!.retry(job.creditOperationId, activate)
      : await activate();
    if (!claimed) throw new ConflictException('Job retry already started');
    if (job.renderManifestReady) {
      await this.enqueueRenders(jobId, true);
    } else {
      await this.enqueuePipeline(jobId);
    }

    return { jobId, status: 'queued_for_retry' };
  }

  private async enqueueClipRetry(jobId: string, clip: Clip, index: number) {
    const parent = await this.findJob(jobId);
    if (!parent || parent.cancellationRequestedAt || parent.deletionRequested)
      return;
    const clipId = clip._id.toString();
    const queued = await this.renderQueue.getJob(renderJobId(jobId, clipId));
    if (!queued) {
      await this.renderQueue.add(
        RENDER_CLIP,
        { jobId, clipId },
        {
          ...MEDIA_JOB_OPTIONS,
          jobId: renderJobId(jobId, clipId),
          priority: index + 1,
        },
      );
    } else {
      const state = await queued.getState();
      if (state === 'failed' || state === 'completed') {
        // The persisted retry timestamp fences progress from the previous attempt.
        try {
          await queued.retry(state, { resetAttemptsMade: true });
        } catch (error) {
          // Another reconciler/API may have already released this deterministic job.
          if (
            !['waiting', 'prioritized', 'delayed', 'active'].includes(
              await queued.getState(),
            )
          )
            throw error;
        }
      } else if (
        !['waiting', 'prioritized', 'delayed', 'active'].includes(state)
      ) {
        throw new ServiceUnavailableException(
          'Clip retry is temporarily unavailable. Please try again.',
        );
      }
    }
    await this.jobModel
      .updateOne(
        {
          _id: jobId,
          clips: {
            $elemMatch: {
              _id: clip._id,
              retryCount: clip.retryCount,
              retryRequested: true,
            },
          },
        },
        { $set: { 'clips.$.retryRequested': false } },
      )
      .exec();
  }

  async retryClip(userId: string, jobId: string, clipId: string) {
    const job = await this.getJobById(userId, jobId);
    if (job.cancellationRequestedAt || job.deletionRequested)
      throw new ConflictException('Cancelled videos cannot be retried.');
    const index = job.clips.findIndex((clip) => clip._id.toString() === clipId);
    const clip = job.clips[index];
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.status !== JobStatus.FAILED && !clip.retryRequested)
      throw new ConflictException('This clip is already processing or ready.');
    if (!job.renderManifestReady)
      throw new ConflictException(
        'This video must finish preparation before clips can be retried.',
      );
    let sourceAvailable: boolean;
    try {
      sourceAvailable =
        !!job.sourceObjectKey &&
        (await this.r2Service.fileExists(job.sourceObjectKey));
    } catch {
      throw new ServiceUnavailableException(
        'Could not check the original video. Please try again shortly.',
      );
    }
    if (!sourceAvailable)
      throw new ConflictException(
        'The original video is no longer available. Add the video again to create this clip.',
      );
    // A terminal Mongo failure can briefly precede BullMQ releasing the worker lock.
    const queued = await this.renderQueue.getJob(renderJobId(jobId, clipId));
    if (
      !clip.retryRequested &&
      queued &&
      (await queued.getState()) === 'active'
    )
      throw new ConflictException(
        'This clip is still finishing its previous attempt. Please try again shortly.',
      );
    let claimed = job;
    if (!clip.retryRequested) {
      const claim = async (session: ClientSession | null = null) =>
        this.jobModel
          .findOneAndUpdate(
            {
              _id: jobId,
              cancellationRequestedAt: null,
              deletionRequested: { $ne: true },
              clips: {
                $elemMatch: { _id: clip._id, status: JobStatus.FAILED },
              },
            },
            {
              $set: {
                status: JobStatus.CUTTING_CLIPS,
                completionPublished: false,
                'clips.$.status': JobStatus.PENDING,
                'clips.$.processingState': ClipProcessingState.QUEUED,
                'clips.$.retryRequested': true,
                'clips.$.retryQueuedAt': new Date(),
              },
              $inc: { 'clips.$.retryCount': 1 },
              $unset: {
                errorMessage: '',
                errorStage: '',
                'clips.$.errorMessage': '',
                'clips.$.errorStage': '',
                'clips.$.failedAt': '',
              },
            },
            { returnDocument: 'after' },
          )
          .session(session)
          .exec();
      const activate = async (session: ClientSession | null = null) => {
        const result = await claim(session);
        if (!result) throw new ConflictException('Clip retry already started');
        return result;
      };
      const result = job.creditOperationId
        ? await this.credits!.retry(job.creditOperationId, activate)
        : await activate();
      if (!result)
        throw new ConflictException('This clip retry has already started.');
      claimed = result;
    }
    try {
      const claimedIndex = claimed.clips.findIndex(
        (c) => c._id.toString() === clipId,
      );
      if (claimedIndex < 0) throw new NotFoundException('Clip not found');
      await this.dispatchMediaJobs(jobId, () =>
        this.enqueueClipRetry(jobId, claimed.clips[claimedIndex], claimedIndex),
      );
    } catch (error) {
      this.logger.warn(`Clip retry dispatch will be reconciled: ${error}`);
      // Durable intent remains pending, including across a server restart.
      throw new ServiceUnavailableException({
        code: 'CLIP_RETRY_PENDING',
        message:
          'Retry is saved, but processing is temporarily unavailable. It will resume automatically.',
      });
    }
    return { jobId, clipId, status: 'queued' as const };
  }

  // Finds FAILED jobs that have not been updated (i.e. not retried) since the
  // given cutoff date. Used by the TTL sweep cron to delete stale jobDirs.
  async findAbandonedFailedJobs(cutoff: Date): Promise<JobDocument[]> {
    return this.jobModel
      .find({
        status: { $in: [JobStatus.FAILED, JobStatus.CANCELLED] },
        $or: [
          { activeExecutions: { $size: 0 } },
          { activeExecutions: { $exists: false } },
        ],
        updatedAt: { $lt: cutoff },
      })
      .exec();
  }
}

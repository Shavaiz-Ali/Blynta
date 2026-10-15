import { EDIT_RENDER_JOB, EDIT_JOB_OPTIONS } from './edit.constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HydratedDocument, Model, Types } from 'mongoose';
import { z } from 'zod';
import { Job, JobStatus } from '../jobs/schemas/job.schema';
import { clipMediaCandidates } from '../studio/clip-media';
import { R2Service } from '../storage/r2.service';
import {
  createPlanSchema,
  objectId,
  parseEdit,
  planSchema,
  updatePlanSchema,
} from './edit-plan.contract';
import type { EditVersion, StoredEditPlan } from './edit.schemas';
import type { StudioAsset } from '../studio/studio.schemas';
import { EditPlanValidatorService } from './edit-plan-validator.service';
import {
  EditAdmissionService,
  editJobId,
  editView,
} from './edit-admission.service';
export { EDIT_QUEUE } from './edit.constants';
import { EDIT_QUEUE } from './edit.constants';
import { EDIT_RENDER_PHASE } from '@blynta/types/contracts';

@Injectable()
export class EditPlansService {
  constructor(
    @InjectModel('EditPlan') private plans: Model<StoredEditPlan>,
    @InjectModel('EditVersion') private versions: Model<EditVersion>,
    @InjectModel(Job.name) private jobs: Model<Job>,
    @InjectQueue(EDIT_QUEUE) private queue: Queue,
    private validator: EditPlanValidatorService,
    private r2: R2Service,
    private admission: EditAdmissionService,
    @Optional() @InjectModel('StudioAsset') private assets?: Model<StudioAsset>,
  ) {}
  private async owned(userId: string, id: string) {
    parseEdit(objectId, id);
    const plan = await this.plans.findOne({ _id: id, userId });
    if (!plan) throw new NotFoundException('EditPlan not found');
    return plan;
  }
  async listClips(userId: string, query: unknown) {
    const input = parseEdit(
      z
        .object({
          search: z.string().trim().max(100).default(''),
          sort: z.enum(['newest', 'oldest']).default('newest'),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        })
        .strict(),
      query,
    );
    const pattern = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [result] = await this.jobs.aggregate<{
      items: object[];
      total: { count: number }[];
    }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          deletionRequested: { $ne: true },
        },
      },
      { $unwind: '$clips' },
      { $match: { 'clips.status': JobStatus.COMPLETED } },
      {
        $set: {
          highlight: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$highlights', []] },
                  as: 'h',
                  cond: {
                    $and: [
                      { $eq: ['$$h.startTime', '$clips.startTime'] },
                      { $eq: ['$$h.endTime', '$clips.endTime'] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          _id: '$clips._id',
          jobId: '$_id',
          title: {
            $ifNull: [
              '$highlight.clipTitle',
              { $ifNull: ['$videoTitle', 'Untitled clip'] },
            ],
          },
          thumbnailUrl: 1,
          duration: { $subtract: ['$clips.endTime', '$clips.startTime'] },
          createdAt: { $ifNull: ['$clips.createdAt', '$createdAt'] },
        },
      },
      ...(pattern
        ? [{ $match: { title: { $regex: pattern, $options: 'i' } } }]
        : []),
      { $sort: { createdAt: input.sort === 'oldest' ? 1 : -1, _id: 1 } },
      {
        $facet: {
          items: [{ $skip: (input.page - 1) * 12 }, { $limit: 12 }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const total = result?.total[0]?.count ?? 0;
    return {
      items: result?.items ?? [],
      page: input.page,
      total,
      totalPages: Math.max(1, Math.ceil(total / 12)),
    };
  }
  async recent(userId: string) {
    const records = await this.plans
      .find({ userId })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(25)
      .lean();
    const available: Record<string, unknown>[] = [];
    const seenClips = new Set<string>();
    for (const plan of records) {
      if (seenClips.has(plan.sourceClipId)) continue;
      const job = await this.jobs
        .findOne({
          _id: plan.sourceMedia.jobId,
          userId,
          deletionRequested: { $ne: true },
          'clips._id': plan.sourceClipId,
        })
        .select('_id thumbnailUrl videoTitle clips highlights')
        .lean();
      if (job) {
        seenClips.add(plan.sourceClipId);
        const latest = await this.versions
          .findOne({ userId, planId: String(plan._id) })
          .sort({ createdAt: -1, _id: -1 })
          .select('status revision')
          .lean();
        available.push({
          ...editView(plan),
          sourceTitle: job.videoTitle,
          thumbnailUrl: job.thumbnailUrl,
          clipTitle: job.highlights?.find((h) => {
            const clip = job.clips?.find(
              (c) => String(c._id) === plan.sourceClipId,
            );
            return (
              clip &&
              h.startTime === clip.startTime &&
              h.endTime === clip.endTime
            );
          })?.clipTitle,
          latestPreview: latest
            ? { status: latest.status, revision: latest.revision }
            : null,
        });
      }
    }
    return { items: available };
  }
  async ownedAssets(userId: string) {
    if (!this.assets) return { items: [] };
    return {
      items: await this.assets
        .find({
          userId,
          status: 'ready',
          $or: [
            { kind: 'image', mimeType: 'image/png' },
            {
              kind: 'audio',
              mimeType: {
                $in: [
                  'audio/mpeg',
                  'audio/wav',
                  'audio/x-wav',
                  'audio/mp4',
                  'audio/ogg',
                ],
              },
            },
          ],
        })
        .select('assetId name kind mimeType duration sourceGroup')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    };
  }
  async create(userId: string, body: unknown, studioInitialization = false) {
    const input = parseEdit(createPlanSchema, body);
    const job = await this.jobs.findOne({ _id: input.jobId, userId });
    const index =
      job?.clips.findIndex(
        (c) => String(c._id) === input.clipId.toLowerCase(),
      ) ?? -1;
    const clip = job?.clips[index];
    if (!clip || !job) throw new NotFoundException('Clip not found');
    if (clip.status !== JobStatus.COMPLETED || job.deletionRequested)
      throw new ConflictException('Clip is not ready to edit');
    let storageKey: string | undefined;
    for (const key of clipMediaCandidates(clip, input.jobId, index))
      if (await this.r2.fileExists(key)) {
        storageKey = key;
        break;
      }
    if (!storageKey) throw new NotFoundException('Clip media is unavailable');
    const duration = clip.endTime - clip.startTime;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
      throw new BadRequestException(
        'Phase 1 source clips must be at most 600 seconds',
      );
    const validated = await this.validator.validate(
      userId,
      input.plan,
      duration,
    );
    try {
      return editView(
        await this.plans.create({
          ...(studioInitialization ? { studioInitialization: true } : {}),
          userId,
          sourceClipId: input.clipId,
          sourceMedia: {
            jobId: input.jobId,
            clipId: input.clipId,
            storageKey,
            duration,
            etag: (await this.r2.objectInfo(storageKey)).etag,
          },
          schemaVersion: 1,
          revision: 1,
          plan: validated.plan,
          outputDuration: validated.timeline.duration,
          status: 'draft',
        }),
      );
    } catch (error) {
      if (!studioInitialization || (error as { code?: number }).code !== 11000)
        throw error;
      const existing = await this.plans.findOne({
        userId,
        sourceClipId: input.clipId,
        studioInitialization: true,
      });
      if (!existing) throw error;
      return this.get(userId, String(existing._id));
    }
  }
  async initialize(userId: string, body: unknown) {
    const input = parseEdit(createPlanSchema.omit({ plan: true }), body);
    const job = await this.jobs.findOne({
      _id: input.jobId,
      userId,
      deletionRequested: { $ne: true },
    });
    const clip = job?.clips.find((c) => String(c._id) === input.clipId);
    if (!job || !clip) throw new NotFoundException('Clip not found');
    if (clip.status !== JobStatus.COMPLETED)
      throw new ConflictException('Clip is not ready to edit');
    const existing = await this.plans
      .findOne({
        userId,
        sourceClipId: input.clipId,
        'sourceMedia.jobId': input.jobId,
      })
      .sort({ updatedAt: -1, _id: -1 });
    if (existing) return this.get(userId, String(existing._id));
    const duration = clip.endTime - clip.startTime;
    const plan = parseEdit(planSchema, {
      schemaVersion: 1,
      timestampSystem: 'output_seconds',
      video: {
        aspectRatio: '9:16',
        segments: [
          { id: 'main', type: 'video', sourceStart: 0, sourceEnd: duration },
        ],
      },
      audio: { original: {}, tracks: [] },
      operations: [],
    });
    // Create reuses every original ownership, source integrity and media/plan limit check.
    // The partial unique index makes the canonical Studio initialization race safe.
    return this.create(userId, { ...input, plan }, true);
  }
  async get(userId: string, id: string): Promise<Record<string, unknown>> {
    const p = await this.owned(userId, id);
    const v = await this.versions.findOne({
      planId: String(p._id),
      revision: p.revision,
      profile: 'preview',
    });
    return { ...editView(p), status: v?.status ?? p.status };
  }
  async validate(userId: string, id: string, body?: unknown) {
    const p = await this.owned(userId, id);
    const validated = await this.validator.validate(
      userId,
      body === undefined ||
        (body &&
          typeof body === 'object' &&
          !Array.isArray(body) &&
          Object.keys(body).length === 0)
        ? p.plan
        : body,
      p.sourceMedia.duration,
    );
    return {
      valid: true,
      outputDuration: validated.timeline.duration,
      timeline: validated.timeline,
    };
  }
  async update(userId: string, id: string, body: unknown, proposalId?: string) {
    const input = parseEdit(updatePlanSchema, body);
    const p = await this.owned(userId, id);
    const validated = await this.validator.validate(
      userId,
      input.plan,
      p.sourceMedia.duration,
    );
    const result = await this.plans.findOneAndUpdate(
      { _id: id, userId, revision: input.revision },
      {
        $set: {
          plan: validated.plan,
          outputDuration: validated.timeline.duration,
          status: 'draft',
          ...(proposalId ? { lastAppliedProposalId: proposalId } : {}),
        },
        $inc: { revision: 1 },
      },
      { new: true },
    );
    if (!result)
      throw new ConflictException(
        'Plan revision changed; reload before updating',
      );
    return editView(result);
  }
  async render(userId: string, id: string, body: unknown = {}) {
    const input = parseEdit(
      z
        .object({ expectedRevision: z.number().int().min(1).optional() })
        .strict(),
      body ?? {},
    );
    const p = await this.owned(userId, id);
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== p.revision
    )
      throw new ConflictException(
        'The saved revision changed; refresh before rendering',
      );
    const validated = await this.validator.validate(
      userId,
      p.plan,
      p.sourceMedia.duration,
    );
    let version: HydratedDocument<EditVersion> | null;
    const identity = {
      planId: String(p._id),
      revision: p.revision,
      profile: 'preview' as const,
    };
    const existing = await this.versions.findOne(identity);
    if (!existing || ['queued', 'processing'].includes(existing.status))
      await this.admission.acquire(userId, this.admission.key(identity));
    try {
      version = await this.versions.findOneAndUpdate(
        identity,
        {
          $setOnInsert: {
            ...identity,
            userId,
            sourceClipId: p.sourceClipId,
            sourceMedia: p.sourceMedia,
            plan: validated.plan,
            assetEtags: Object.fromEntries(
              [...validated.media]
                .filter(([, a]) => a.etag)
                .map(([id, a]) => [id, a.etag]),
            ),
            outputDuration: p.outputDuration,
            status: 'queued',
            progress: 0,
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      version = await this.versions.findOne(identity);
    }
    if (!version)
      throw new ConflictException('Could not create render version');
    // The DB intent precedes queue publication. Repeated calls repair a failed enqueue.
    if (version.status === 'queued') {
      await this.plans.updateOne(
        { _id: p._id, revision: p.revision },
        { $set: { status: 'queued' } },
      );
      await this.queue.add(
        EDIT_RENDER_JOB,
        { versionId: String(version._id), generation: version.generation ?? 0 },
        {
          jobId: editJobId(String(version._id), version.generation),
          ...EDIT_JOB_OPTIONS,
        },
      );
    }
    return editView(version);
  }
  async listVersions(userId: string, id: string, page = 1) {
    const p = await this.owned(userId, id);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Invalid page');
    const items = await this.versions
      .find({ userId, planId: String(p._id) })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * 25)
      .limit(25);
    return { items: items.map(editView), page, pageSize: 25 };
  }
  async getVersion(userId: string, id: string) {
    parseEdit(objectId, id);
    const v = await this.versions.findOne({ _id: id, userId }).lean();
    if (!v) throw new NotFoundException('Edit version not found');
    let live: { phase?: string; progress?: number } = {};
    if (v.status === 'processing' && v.executionToken) {
      const queued = await this.queue.getJob(
        editJobId(String(v._id), v.generation),
      );
      const tick = queued?.progress as Record<string, unknown> | undefined;
      if (
        tick &&
        typeof tick === 'object' &&
        tick.executionToken === v.executionToken &&
        tick.generation === (v.generation ?? 0) &&
        tick.attempt === v.attempt
      ) {
        live = {
          phase:
            typeof tick.phase === 'string' &&
            Object.values(EDIT_RENDER_PHASE).some((p) => p === tick.phase)
              ? tick.phase
              : v.phase,
          progress:
            typeof tick.encodingPercent === 'number' &&
            Number.isFinite(tick.encodingPercent)
              ? Math.min(99, Math.max(0, tick.encodingPercent))
              : v.progress,
        };
      }
    }
    return {
      ...editView(v),
      ...live,
      outputUrl:
        v.status === 'completed' && v.outputKey
          ? await this.r2.getSignedDownloadUrl(v.outputKey, 3600)
          : undefined,
    };
  }
  async downloadVersion(userId: string, id: string) {
    parseEdit(objectId, id);
    const version = await this.versions.findOne({ _id: id, userId });
    if (!version) throw new NotFoundException('Edit version not found');
    if (version.status !== 'completed' || !version.outputKey)
      throw new ConflictException('Preview is not ready to download');
    const source = await this.jobs.exists({
      _id: version.sourceMedia.jobId,
      userId,
      deletionRequested: { $ne: true },
      'clips._id': version.sourceClipId,
    });
    if (!source) throw new NotFoundException('Source clip is unavailable');
    return {
      signedUrl: await this.r2.getSignedDownloadUrl(
        version.outputKey,
        3600,
        `blynta-edit-r${version.revision}.mp4`,
      ),
    };
  }
  async retry(userId: string, id: string) {
    parseEdit(objectId, id);
    const prior = await this.versions.findOne({ _id: id, userId });
    if (!prior) throw new NotFoundException('Edit version not found');
    if (
      prior.status !== 'failed' ||
      prior.retryable === false ||
      (prior.manualRetries ?? 0) >= 3
    )
      throw new ConflictException(
        'Only failed versions with retry budget can be retried',
      );
    await this.validator.validate(
      userId,
      prior.plan,
      prior.sourceMedia.duration,
    );
    await this.admission.acquire(
      userId,
      this.admission.key({
        planId: prior.planId,
        revision: prior.revision,
        profile: prior.profile,
        generation: (prior.generation ?? 0) + 1,
      }),
    );
    const v = await this.versions.findOneAndUpdate(
      {
        _id: id,
        userId,
        status: 'failed',
        ...(prior.generation
          ? { generation: prior.generation }
          : { $or: [{ generation: 0 }, { generation: { $exists: false } }] }),
      },
      {
        $set: {
          status: 'queued',
          progress: 0,
          phase: EDIT_RENDER_PHASE.QUEUED,
        },
        $inc: { generation: 1, manualRetries: 1 },
        $unset: {
          error: '',
          errorCode: '',
          retryable: '',
          executionToken: '',
          executionExpiresAt: '',
        },
      },
      { new: true },
    );
    if (!v)
      throw new ConflictException(
        'Version state changed; reload before retrying',
      );
    await this.queue.add(
      EDIT_RENDER_JOB,
      { versionId: id, generation: v.generation },
      {
        jobId: editJobId(id, v.generation),
        ...EDIT_JOB_OPTIONS,
      },
    );
    return editView(v);
  }
  async cancel(userId: string, id: string) {
    parseEdit(objectId, id);
    const v = await this.versions.findOneAndUpdate(
      { _id: id, userId, status: { $in: ['queued', 'processing'] } },
      {
        $set: {
          status: 'cancelled',
          phase: EDIT_RENDER_PHASE.CANCELLED,
          progress: 0,
        },
      },
      { new: true },
    );
    if (!v) {
      const existing = await this.getVersion(userId, id);
      if ((existing as Record<string, unknown>).status !== 'cancelled')
        throw new ConflictException('Version has already finished');
      return existing;
    }
    await this.admission.release(userId, this.admission.key(v));
    await this.plans.updateOne(
      { _id: v.planId, revision: v.revision },
      { $set: { status: 'cancelled' } },
    );
    const queued = await this.queue.getJob(
      editJobId(String(v._id), v.generation),
    );
    if (queued && (await queued.getState()) !== 'active') await queued.remove();
    return editView(v);
  }
}

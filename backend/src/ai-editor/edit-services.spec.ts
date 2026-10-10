import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Job as QueueJob, Queue } from 'bullmq';
import { Job as MediaJob } from '../jobs/schemas/job.schema';
import { R2Service } from '../storage/r2.service';
import type { StudioAsset } from '../studio/studio.schemas';
import { EditPlanValidatorService } from './edit-plan-validator.service';
import { EditAdmissionService } from './edit-admission.service';
import { EditPlansService } from './edit-plans.service';
import { EditRenderProcessor } from './edit-render.processor';
import { EditRenderService } from './edit-render.service';
import type { EditVersion, StoredEditPlan } from './edit.schemas';
import { examplePlan } from './edit-plan.fixture';
import { existsSync } from 'node:fs';
import { assertNotCancelled } from '../jobs/cancellation-context';
import { BadRequestException } from '@nestjs/common';

describe('editing asset authorization', () => {
  const assetId = 'music';
  function setup(records: Partial<StudioAsset>[]) {
    const query = {
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(records),
    };
    const assets = { find: jest.fn().mockReturnValue(query) };
    const r2 = {
      objectInfo: jest
        .fn()
        .mockResolvedValue({ size: 100, contentType: 'audio/mpeg' }),
    };
    const validator = new EditPlanValidatorService(
      assets as unknown as Model<StudioAsset>,
      r2 as unknown as R2Service,
    );
    const p = examplePlan();
    p.audio.tracks = [
      {
        id: 'track',
        assetId,
        role: 'music_track',
        start: 0,
        sourceStart: 0,
        sourceEnd: 2,
        enabled: true,
        gain: 0.1,
        fadeIn: 0,
        fadeOut: 0,
        mutes: [],
        automation: [],
      },
    ];
    return { validator, p, assets, r2 };
  }
  it('scopes every lookup to the authenticated owner and requires ready media', async () => {
    const s = setup([]);
    await expect(s.validator.validate('owner', s.p, 3)).rejects.toThrow();
    expect(s.assets.find).toHaveBeenCalledWith({
      userId: 'owner',
      assetId,
      status: 'ready',
    });
    expect(s.r2.objectInfo).not.toHaveBeenCalled();
  });
  it('rejects missing streams, oversized assets and trims beyond the source', async () => {
    const record = {
      kind: 'audio' as const,
      mimeType: 'audio/mpeg',
      storageKey: 'owned/key',
      duration: 3,
      hasAudio: true,
    };
    const s = setup([record]);
    await expect(s.validator.validate('owner', s.p, 3)).resolves.toHaveProperty(
      'media',
    );
    s.r2.objectInfo.mockResolvedValue({
      size: 101 * 1024 * 1024,
      contentType: 'audio/mpeg',
    });
    await expect(s.validator.validate('owner', s.p, 3)).rejects.toThrow(
      '100 MiB',
    );
    await expect(
      setup([{ ...record, hasAudio: false }]).validator.validate(
        'owner',
        s.p,
        3,
      ),
    ).rejects.toThrow('validated audio');
    s.p.audio.tracks[0].sourceEnd = 4;
    await expect(
      setup([record]).validator.validate('owner', s.p, 3),
    ).rejects.toThrow('trim exceeds');
  });
  it('returns actionable field issues when an owned R2 asset has been removed', async () => {
    const s = setup([
      {
        kind: 'audio',
        mimeType: 'audio/mpeg',
        storageKey: 'owned/key',
        duration: 3,
        hasAudio: true,
      },
    ]);
    s.r2.objectInfo.mockRejectedValueOnce({ name: 'NoSuchKey' });
    await expect(s.validator.validate('owner', s.p, 3)).rejects.toMatchObject({
      response: {
        code: 'INVALID_EDIT_ASSET',
        issues: [
          {
            path: 'assets.music',
            message: 'Media object is no longer available',
          },
        ],
      },
    });
  });
});

describe('editing persistence and queue contract', () => {
  function setup() {
    const p = {
      _id: new Types.ObjectId(),
      userId: 'owner',
      revision: 1,
      sourceClipId: 'clip',
      sourceMedia: {
        jobId: 'job',
        clipId: 'clip',
        storageKey: 'owned/key',
        duration: 3,
      },
      plan: examplePlan(),
      outputDuration: 3,
    };
    const version = {
      ...p,
      _id: new Types.ObjectId(),
      status: 'queued',
      planId: String(p._id),
      profile: 'preview',
    };
    const plans = {
      findOne: jest.fn().mockResolvedValue(p),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };
    const versions = {
      findOne: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockResolvedValue(0),
      findOneAndUpdate: jest.fn().mockResolvedValue(version),
    };
    const validator = {
      validate: jest.fn().mockResolvedValue({
        plan: p.plan,
        timeline: { duration: 3 },
        media: new Map(),
      }),
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const service = new EditPlansService(
      plans as unknown as Model<StoredEditPlan>,
      versions as unknown as Model<EditVersion>,
      {} as Model<MediaJob>,
      queue as unknown as Queue,
      validator as unknown as EditPlanValidatorService,
      {} as R2Service,
      {
        acquire: jest.fn(),
        release: jest.fn(),
        key: () => 'key',
      } as unknown as EditAdmissionService,
    );
    return { service, p, plans, versions, validator, queue, version };
  }
  it('uses owner predicates and optimistic revisions; returns a conflict on stale edits', async () => {
    const s = setup();
    await expect(
      s.service.update('owner', String(s.p._id), {
        revision: 1,
        plan: s.p.plan,
      }),
    ).rejects.toThrow('revision changed');
    expect(s.plans.findOne).toHaveBeenCalledWith({
      _id: String(s.p._id),
      userId: 'owner',
    });
    expect(
      (s.plans.findOneAndUpdate.mock.calls as unknown[][])[0][0],
    ).toMatchObject({
      userId: 'owner',
      revision: 1,
    });
    s.plans.findOne.mockResolvedValue(null);
    await expect(s.service.get('other', String(s.p._id))).rejects.toThrow(
      'not found',
    );
  });
  it('snapshots a revision once and uses deterministic queue identities to repair publication', async () => {
    const s = setup();
    s.queue.add.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(s.service.render('owner', String(s.p._id))).rejects.toThrow(
      'Redis unavailable',
    );
    await s.service.render('owner', String(s.p._id));
    expect(
      (s.versions.findOneAndUpdate.mock.calls as unknown[][])[0][0],
    ).toEqual({
      planId: String(s.p._id),
      revision: 1,
      profile: 'preview',
    });
    expect(
      (s.versions.findOneAndUpdate.mock.calls as unknown[][])[0][1],
    ).toHaveProperty('$setOnInsert.plan', s.p.plan);
    expect((s.queue.add.mock.calls as unknown[][])[0][2]).toEqual(
      (s.queue.add.mock.calls as unknown[][])[1][2],
    );
    expect((s.queue.add.mock.calls as unknown[][])[1][2]).toHaveProperty(
      'jobId',
      `edit-${String(s.version._id)}`,
    );
  });
});

describe('editing worker publication and retries', () => {
  function setup() {
    const state = {
      _id: new Types.ObjectId(),
      userId: 'owner',
      planId: 'plan',
      revision: 1,
      sourceClipId: 'clip',
      sourceMedia: {
        jobId: 'job',
        clipId: 'clip',
        storageKey: 'owned/key',
        duration: 3,
      },
      plan: examplePlan(),
      outputDuration: 3,
      profile: 'preview',
      status: 'processing',
      progress: 1,
    };
    const versions = {
      findOneAndUpdate: jest.fn().mockResolvedValue(state),
      findById: jest
        .fn()
        .mockReturnValue({ lean: () => Promise.resolve({ ...state }) }),
      updateOne: jest
        .fn()
        .mockImplementation(
          (_filter: unknown, update: { $set?: { status?: string } }) => {
            if (update.$set?.status) state.status = update.$set.status;
            return Promise.resolve({
              modifiedCount: 1,
              matchedCount: state.status === 'cancelled' ? 0 : 1,
            });
          },
        ),
    };
    const plans = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    let directory: string | undefined;
    const renderer = {
      render: jest
        .fn()
        .mockImplementation(
          (_version: unknown, dir: string, progress: (n: number) => void) => {
            directory = dir;
            progress(30);
            return Promise.resolve({ outputPath: `${dir}/output.mp4` });
          },
        ),
    };
    const r2 = {
      uploadFile: jest.fn().mockResolvedValue('key'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new EditRenderProcessor(
      versions as unknown as Model<EditVersion>,
      plans as unknown as Model<StoredEditPlan>,
      renderer as unknown as EditRenderService,
      r2 as unknown as R2Service,
      {
        get: (_key: string, fallback: number) => fallback,
      } as unknown as ConfigService,
      {} as Queue,
      {
        acquire: jest.fn(),
        release: jest.fn(),
        key: () => 'key',
      } as unknown as EditAdmissionService,
    );
    const job = {
      name: 'EDIT_RENDER_PREVIEW',
      data: { versionId: String(state._id) },
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueueJob<{ versionId: string }>;
    return {
      state,
      versions,
      plans,
      renderer,
      r2,
      processor,
      job,
      directory: () => directory,
    };
  }
  it('publishes one immutable version and always removes its temporary workspace', async () => {
    const s = setup();
    await s.processor.process(s.job);
    expect(s.state.status).toBe('completed');
    expect(s.r2.uploadFile).toHaveBeenCalledTimes(1);
    expect(String((s.r2.uploadFile.mock.calls as unknown[][])[0][1])).toContain(
      'job-sources/edits/owner/clip/',
    );
    expect(existsSync(s.directory()!)).toBe(false);
  });
  it('cleans an interrupted upload and returns retriable work to queued', async () => {
    const s = setup();
    s.r2.uploadFile.mockRejectedValueOnce(new Error('Interrupted upload'));
    await expect(s.processor.process(s.job)).rejects.toThrow(
      'Interrupted upload',
    );
    expect(s.state.status).toBe('queued');
    expect(s.r2.deleteFile).toHaveBeenCalledTimes(1);
    expect(existsSync(s.directory()!)).toBe(false);
  });
  it('records final failures and refuses unsupported final-render jobs', async () => {
    const s = setup();
    s.renderer.render.mockRejectedValueOnce(new Error('Invalid graph'));
    s.job.attemptsMade = 2;
    await expect(s.processor.process(s.job)).rejects.toThrow('Invalid graph');
    expect(s.state.status).toBe('failed');
    s.job.name = 'EDIT_RENDER_FINAL';
    await expect(s.processor.process(s.job)).rejects.toThrow('Only preview');
  });
  it('stops retrying permanent validation failures on the first attempt', async () => {
    const s = setup();
    s.renderer.render.mockRejectedValueOnce(
      new BadRequestException('Invalid asset'),
    );
    await expect(s.processor.process(s.job)).rejects.toThrow(
      'validation failed',
    );
    expect(s.state.status).toBe('failed');
    expect(s.r2.uploadFile).not.toHaveBeenCalled();
  });
  it('discards queue delivery from an older manual retry generation', async () => {
    const s = setup();
    s.versions.findOneAndUpdate.mockResolvedValue(null);
    s.versions.findById.mockResolvedValue({ status: 'queued', generation: 1 });
    await s.processor.process(s.job);
    expect(s.renderer.render).not.toHaveBeenCalled();
  });
  it('a stale uploaded attempt deletes only its own object and never changes the winning plan state', async () => {
    const s = setup();
    const winner = 'job-sources/edits/winning-attempt.mp4';
    s.versions.findById.mockReturnValue({
      lean: () => Promise.resolve({ status: 'completed', outputKey: winner }),
    });
    s.versions.updateOne.mockImplementation(
      (_filter: unknown, update: Record<string, unknown>) =>
        Promise.resolve({
          modifiedCount: '$addToSet' in update ? 1 : 0,
          matchedCount: 0,
        }),
    );
    await expect(s.processor.process(s.job)).rejects.toThrow('publication');
    const uploadedKey = (s.r2.uploadFile.mock.calls as unknown[][])[0][1];
    expect(uploadedKey).not.toBe(winner);
    expect(s.r2.deleteFile).toHaveBeenCalledWith(uploadedKey);
    expect(s.r2.deleteFile).not.toHaveBeenCalledWith(winner);
    expect(s.plans.updateOne).toHaveBeenCalledTimes(1);
    const completionFilter = (
      s.versions.updateOne.mock.calls as unknown[][]
    ).find(
      ([, update]) =>
        (update as { $set?: { status?: string } }).$set?.status === 'completed',
    )?.[0];
    expect(completionFilter).toHaveProperty('executionExpiresAt');
  });
  it('never removes delivered output if a later plan-status write fails', async () => {
    const s = setup();
    s.plans.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockRejectedValueOnce(new Error('Mongo response lost'));
    await s.processor.process(s.job);
    expect(s.state.status).toBe('completed');
    expect(s.r2.deleteFile).not.toHaveBeenCalled();
  });
  it('does not render completed or cancelled versions again', async () => {
    const s = setup();
    s.versions.findOneAndUpdate.mockResolvedValue(null);
    s.versions.findById.mockResolvedValue({ status: 'completed' });
    await s.processor.process(s.job);
    expect(s.renderer.render).not.toHaveBeenCalled();
    s.versions.findById.mockResolvedValue({ status: 'cancelled' });
    await s.processor.process(s.job);
    expect(s.renderer.render).not.toHaveBeenCalled();
  });
  it('defers a stalled attempt while the current execution holds a lease', async () => {
    const s = setup();
    s.versions.findOneAndUpdate.mockResolvedValue(null);
    s.versions.findById.mockResolvedValue({ status: 'processing' });
    const moveToDelayed = jest.fn().mockResolvedValue(undefined);
    s.job.moveToDelayed = moveToDelayed;
    await expect(s.processor.process(s.job, 'bull-lock')).rejects.toThrow();
    expect(moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'bull-lock');
    expect(s.renderer.render).not.toHaveBeenCalled();
  });
  it('aborts active work when cancellation is persisted and never publishes output', async () => {
    const s = setup();
    s.renderer.render.mockImplementationOnce(async () => {
      s.state.status = 'cancelled';
      await new Promise((resolve) => setTimeout(resolve, 1200));
      assertNotCancelled();
      return { outputPath: 'unused' };
    });
    await s.processor.process(s.job);
    expect(s.state.status).toBe('cancelled');
    expect(s.r2.uploadFile).not.toHaveBeenCalled();
  });
  it('leaves failed cleanup durable for reconciliation without erasing retry state', async () => {
    const s = setup();
    s.r2.uploadFile.mockRejectedValueOnce(new Error('Interrupted upload'));
    s.r2.deleteFile.mockRejectedValueOnce(new Error('R2 unavailable'));
    await expect(s.processor.process(s.job)).rejects.toThrow(
      'Interrupted upload',
    );
    expect(s.state.status).toBe('queued');
    expect(s.versions.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $addToSet: expect.objectContaining({
          pendingOutputKeys: expect.any(String) as unknown,
        }) as unknown,
      }),
    );
    const last = (s.versions.updateOne.mock.calls as unknown[][]).at(
      -1,
    )![1] as { $unset: Record<string, unknown> };
    expect(last.$unset).not.toHaveProperty('pendingOutputKeys');
  });
});

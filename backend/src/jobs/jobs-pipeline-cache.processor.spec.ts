import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Model, Types, model as mongooseModel } from 'mongoose';
import { Queue } from 'bullmq';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheFixture } from '../../test/pipeline-cache.fixture';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';
import { JOBS_TYPES } from './jobs.constants';
import {
  JobDocument,
  JobStatus,
  SourcePlatform,
  JobSchema,
} from './schemas/job.schema';
import { SourceVideoDocument } from './schemas/source-video.schema';
import { SourceVideoService } from '../media/services/source-video.service';
import { HighlightDetectionService } from '../media/services/highlight-detection.service';
import { TranscriptionService } from '../media/services/transcription.service';
import { VideoDownloadService } from '../media/services/video-download.service';
import { MediaInspectionService } from '../media/services/media-inspection.service';
import { R2Service } from '../storage/r2.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import { RenderEtaService } from './render-eta.service';
import { CreditsService } from '../billing/credits.service';
import { JobsCompletionService } from './jobs-completion.service';
import { INITIAL_PRICING, clipPrice } from '../billing/credit-pricing';
import {
  sourceDurationAuthorized,
  SourceAuthorizationError,
} from '../billing/source-authorization';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  NoObjectGeneratedError: { isInstance: () => false },
  RetryError: { isInstance: () => false },
}));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => () => 'model',
}));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ chat: () => 'model' }),
}));

describe('real pipeline uses layered cache with each job’s Billing V2 authorization', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'blynta-cache-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    jest.restoreAllMocks();
  });
  function fixture() {
    const cache = cacheFixture();
    const objects = new Map<string, Buffer>();
    const parents = new Map<string, JobDocument>();
    let source: SourceVideoDocument | null = null;
    const operations = new Map<
      string,
      {
        operationId: string;
        product: 'ai-clips';
        sourceSeconds: number;
        maxOutputSeconds: number;
        authorized: number;
        charged: number;
        status: string;
        pricing: typeof INITIAL_PRICING;
      }
    >();
    const sourceModel = {
      findOne: jest.fn(() => ({ exec: () => Promise.resolve(source) })),
      findOneAndUpdate: jest.fn(
        (_filter: object, update: { $set: object }) => ({
          exec: () => {
            source = Object.assign(
              source ?? { _id: new Types.ObjectId() },
              update.$set,
            ) as SourceVideoDocument;
            return Promise.resolve(source);
          },
        }),
      ),
      updateOne: jest.fn((_filter: object, update: { $set?: object }) => ({
        exec: () => {
          if (source && update.$set) Object.assign(source, update.$set);
          return Promise.resolve({ modifiedCount: 1 });
        },
      })),
    };
    const sources = new SourceVideoService(
      sourceModel as unknown as Model<SourceVideoDocument>,
      new ConfigService(),
    );
    const config = new ConfigService({
      STORAGE_ROOT: root,
      LLM_PROVIDER: 'google',
      LLM_API_KEY: 'test',
    });
    const transcript = Array.from({ length: 12 }, (_, i) => ({
      startTime: i * 80,
      endTime: i * 80 + 60,
      text: `Moment ${i} is a complete funny and useful source insight`,
    }));
    const pool = transcript.map((s, i) => ({
      startTime: s.startTime,
      endTime: s.startTime + 45,
      score: 0.95 - i * 0.001,
      clipTitle: 'Clip ' + i,
      clipDescription: 'Complete insight',
      reason: 'Complete moment',
      tags: [],
      style: 'curiosity-hook',
      contextComplete: true,
      presetRelevant: true,
      groundedQuote: s.text,
    }));
    const detection = new HighlightDetectionService(config);
    const discover = jest
      .spyOn(detection, 'discoverCandidatesWithMetadata')
      .mockResolvedValue({
        videoTitle: 'Video',
        videoDescription: '',
        keywords: '',
        hashtags: [],
        highlights: pool,
        candidates: pool,
        cacheable: true,
        coverageSeconds: 3233.461,
      });
    const transcribe = {
      cacheConfiguration: jest.fn().mockResolvedValue('whisper-settings-v1'),
      transcribe: jest.fn().mockResolvedValue(transcript),
    };
    const download = {
      canShareSource: jest.fn().mockResolvedValue(true),
      extractAudio: jest.fn((_video: string, audio: string) =>
        writeFile(audio, 'audio-bytes'),
      ),
      downloadVideo: jest.fn(async (_url: string, dir: string) => {
        const videoPath = join(dir, 'source.mp4'),
          audioPath = join(dir, 'audio.wav');
        await writeFile(videoPath, 'video-bytes');
        await writeFile(audioPath, 'audio-bytes');
        return {
          videoPath,
          audioPath,
          duration: 3233.461,
          title: 'Video',
          uploader: 'Channel',
          thumbnailUrl: '',
        };
      }),
    };
    const storage = {
      fileExists: jest.fn((key: string) => Promise.resolve(objects.has(key))),
      uploadFile: jest.fn(async (file: string, key: string) => {
        objects.set(key, await readFile(file));
        return key;
      }),
      downloadToLocal: jest.fn(async (key: string, destination: string) => {
        const bytes = objects.get(key);
        if (!bytes) throw new Error('missing object');
        await writeFile(destination, bytes);
      }),
    };
    const inspection = {
      inspect: jest.fn(async (file: string) => {
        const bytes = await readFile(file);
        if (bytes.toString() === 'corrupt') throw new Error('invalid media');
        const audio = file.endsWith('.wav');
        return {
          durationSeconds: 3233.461,
          hasVideo: !audio,
          hasAudio: true,
          width: 426,
          height: 240,
          fps: 25,
        };
      }),
    };
    const jobModel = {
      findById: (id: string) => ({
        exec: () => Promise.resolve(parents.get(id) ?? null),
      }),
      findOneAndUpdate: (_filter: { _id: string }, values: object) => ({
        exec: () => {
          const parent = parents.get(_filter._id);
          if (parent) Object.assign(parent, values);
          return Promise.resolve(parent);
        },
      }),
      updateOne: (filter: { _id: string }, update: { $set: object }) => ({
        exec: () => {
          const parent = parents.get(filter._id);
          if (parent) Object.assign(parent, update.$set);
          return Promise.resolve({ modifiedCount: 1 });
        },
      }),
    };
    const credits = {
      operations: {
        findOne: ({ operationId }: { operationId: string }) =>
          Promise.resolve(operations.get(operationId)),
      },
      assertSourceBudget: jest.fn((id: string, duration: number) => {
        const op = operations.get(id)!;
        return sourceDurationAuthorized(op, duration)
          ? Promise.resolve()
          : Promise.reject(
              new SourceAuthorizationError(op.sourceSeconds, duration),
            );
      }),
      settle: jest.fn((id: string, amount: number) => {
        const op = operations.get(id)!;
        if (amount > op.authorized) throw new Error('authorization exceeded');
        op.status = 'settled';
        op.charged = amount;
        return Promise.resolve();
      }),
    };
    const users = {
      findById: jest.fn().mockResolvedValue({ plan: 'business' }),
    };
    const jobs = new JobsService(
      jobModel as unknown as Model<JobDocument>,
      {} as Queue,
      {} as Queue,
      users as unknown as UsersService,
      config,
      storage as unknown as R2Service,
      {} as ActivitiesService,
      {} as RenderEtaService,
      undefined,
      credits as unknown as CreditsService,
    );
    jest
      .spyOn(jobs, 'runMediaExecution')
      .mockImplementation((_id, work) => work());
    const enqueue = jest
      .spyOn(jobs, 'enqueueRenders')
      .mockResolvedValue(undefined);
    const completion = { finalize: jest.fn().mockResolvedValue(undefined) };
    const processor = new JobsProcessor(
      jobs,
      users as unknown as UsersService,
      config,
      download as unknown as VideoDownloadService,
      transcribe as unknown as TranscriptionService,
      detection,
      sources,
      storage as unknown as R2Service,
      inspection as unknown as MediaInspectionService,
      completion as unknown as JobsCompletionService,
      { queueCreateIfNotExists: jest.fn() } as unknown as ActivitiesService,
      cache.cache,
    );
    async function run(
      options: {
        plan?: string;
        preset?: string;
        customPrompt?: string;
        budget?: number;
        owner?: string;
        url?: string;
        defer?: boolean;
      } = {},
    ) {
      const id = new Types.ObjectId().toString();
      const cap = options.plan === 'free' ? 6 : 9,
        budget = options.budget ?? cap * 60;
      const operationId = 'operation-' + id;
      operations.set(operationId, {
        operationId,
        product: 'ai-clips',
        sourceSeconds: 3233,
        maxOutputSeconds: budget,
        authorized: clipPrice(3233, budget, INITIAL_PRICING).totalCredits,
        charged: 0,
        status: 'reserved',
        pricing: INITIAL_PRICING,
      });
      const parent = {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(options.owner ?? '507f1f77bcf86cd799439011'),
        sourceUrl: options.url ?? 'https://youtu.be/B6NVvtIz9_Q?tracking=x',
        sourcePlatform: SourcePlatform.YOUTUBE,
        status: JobStatus.PENDING,
        clipTargetMax: cap,
        creditOperationId: operationId,
        creditSourceSeconds: 3233,
        creditOutputSeconds: budget,
        videoDuration: 3233,
        stylePreset: options.preset ?? 'default',
        customPrompt: options.customPrompt,
        clips: [],
        transcript: [],
        highlights: [],
        activeExecutions: [],
      } as unknown as JobDocument;
      parents.set(id, parent);
      users.findById.mockResolvedValue({ plan: options.plan ?? 'business' });
      const bull = {
        name: JOBS_TYPES.CLIP_VIDEO,
        data: { jobId: id },
        attemptsMade: 0,
        timestamp: Date.now(),
      };
      if (!options.defer) await processor.process(bull as never);
      return { id, parent, bull, op: operations.get(operationId)! };
    }
    return {
      run,
      processor,
      objects,
      cache,
      discover,
      detection,
      transcribe,
      transcript,
      download,
      credits,
      jobs,
      enqueue,
      parents,
      inspection,
      source: () => source,
    };
  }
  test.each(['missing', 'invalid'] as const)(
    'resume regenerates %s transcript without downloading or metadata probing',
    async (mode) => {
      const f = fixture();
      const { parent, bull } = await f.run({ defer: true });
      parent.localVideoPath = join(root, 'resume.mp4');
      parent.localAudioPath = join(root, 'resume.wav');
      await writeFile(parent.localVideoPath, 'video-bytes');
      await writeFile(parent.localAudioPath, 'audio-bytes');
      if (mode === 'invalid')
        parent.transcript = [{ startTime: 0, endTime: 0, text: 'bad' }];
      parent.transcriptSignature = 'whisper-settings-v1';
      f.download.canShareSource.mockRejectedValue(
        new Error('metadata authentication failure'),
      );
      await f.processor.process(bull as never);
      expect(f.download.canShareSource).not.toHaveBeenCalled();
      expect(f.download.downloadVideo).not.toHaveBeenCalled();
      expect(f.download.extractAudio).not.toHaveBeenCalled();
      expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
      expect(parent.transcript[0].endTime).toBeGreaterThan(0);
    },
  );
  test('resume reuses a valid compatible transcript', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    parent.localVideoPath = join(root, 'resume.mp4');
    await writeFile(parent.localVideoPath, 'video-bytes');
    parent.transcript = structuredClone(f.transcript);
    parent.transcriptSignature = 'whisper-settings-v1';
    await f.processor.process(bull as never);
    expect(f.transcribe.transcribe).not.toHaveBeenCalled();
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
  });
  test('resume hashes a hydrated saved transcript without recursion, re-download or re-transcription', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    const SavedJob = mongooseModel(
      'PipelineHydratedResumeRegression',
      JobSchema,
    );
    parent.localVideoPath = join(root, 'hydrated-resume.mp4');
    parent.localAudioPath = join(root, 'hydrated-resume.wav');
    await writeFile(parent.localVideoPath, 'video-bytes');
    await writeFile(parent.localAudioPath, 'audio-bytes');
    parent.transcript = new SavedJob({ transcript: f.transcript }).transcript;
    parent.transcriptSignature = 'whisper-settings-v1';
    await f.processor.process(bull as never);
    expect(f.transcribe.transcribe).not.toHaveBeenCalled();
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
    expect(f.download.extractAudio).not.toHaveBeenCalled();
    expect(f.discover).toHaveBeenCalledTimes(1);
  });
  test('resume repairs a readable but checksum-invalid local video from its durable source', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    parent.localVideoPath = join(root, 'partial.mp4');
    await writeFile(parent.localVideoPath, 'partial-video');
    parent.sourceContentHash = createHash('sha256')
      .update('video-bytes')
      .digest('hex');
    parent.sourceObjectKey = 'durable-source';
    f.objects.set('durable-source', Buffer.from('video-bytes'));
    await f.processor.process(bull as never);
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
    expect(f.download.canShareSource).not.toHaveBeenCalled();
    expect(parent.sourceContentHash).toBe(
      createHash('sha256').update('video-bytes').digest('hex'),
    );
    expect(parent.transcript.length).toBeGreaterThan(0);
  });
  test('resume replaces a partial audio file and reports the ASR stage accurately', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    parent.localVideoPath = join(root, 'resume.mp4');
    parent.localAudioPath = join(root, 'resume.wav');
    await writeFile(parent.localVideoPath, 'video-bytes');
    await writeFile(parent.localAudioPath, 'corrupt');
    f.transcribe.transcribe.mockRejectedValueOnce(new Error('ASR unavailable'));
    await expect(f.processor.process(bull as never)).rejects.toThrow(
      'ASR unavailable',
    );
    expect(parent.status).toBe(JobStatus.TRANSCRIBING);
    expect(parent.errorStage).toBe(JobStatus.TRANSCRIBING);
    expect(f.download.extractAudio).toHaveBeenCalledTimes(1);
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
    await f.processor.process(bull as never);
    expect(f.download.extractAudio).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(2);
  });
  test('interrupted transcript persistence resumes from a validated cache artifact', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    parent.localVideoPath = join(root, 'resume.mp4');
    parent.localAudioPath = join(root, 'resume.wav');
    await writeFile(parent.localVideoPath, 'video-bytes');
    await writeFile(parent.localAudioPath, 'audio-bytes');
    const original = f.jobs.updateJob.bind(f.jobs);
    let interrupted = false;
    const update = jest
      .spyOn(f.jobs, 'updateJob')
      .mockImplementation((id, values) => {
        if ('transcript' in values && !interrupted) {
          interrupted = true;
          return Promise.reject(new Error('DB interrupted'));
        }
        return original(id, values);
      });
    await expect(f.processor.process(bull as never)).rejects.toThrow(
      'DB interrupted',
    );
    expect(parent.transcript).toEqual([]);
    update.mockRestore();
    await f.processor.process(bull as never);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
    expect(parent.transcript.length).toBeGreaterThan(0);
  });
  test('invalid ASR output never publishes an artifact or reaches highlights and can retry', async () => {
    const f = fixture();
    const { parent, bull } = await f.run({ defer: true });
    f.transcribe.transcribe.mockResolvedValueOnce([
      { startTime: 0, endTime: 0, text: 'bad' },
    ]);
    await expect(f.processor.process(bull as never)).rejects.toThrow(
      'non_positive_segment_duration',
    );
    expect(parent.transcript).toEqual([]);
    expect(parent.errorStage).toBe(JobStatus.TRANSCRIBING);
    expect(f.cache.rows.size).toBe(0);
    expect(f.discover).not.toHaveBeenCalled();
    await f.processor.process(bull as never);
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(parent.transcript.length).toBeGreaterThan(0);
  });
  test.each([undefined, 'A private prompt'])(
    'identical source and instructions reuse all layers (%s)',
    async (customPrompt) => {
      const f = fixture();
      await f.run({ customPrompt });
      const second = await f.run({
        customPrompt,
        url: 'https://www.youtube.com/watch?v=B6NVvtIz9_Q&feature=share',
      });
      expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
      expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
      expect(f.discover).toHaveBeenCalledTimes(1);
      expect(second.parent.clips).toHaveLength(9);
      expect(f.credits.assertSourceBudget).toHaveBeenCalledWith(
        second.op.operationId,
        3233.461,
      );
    },
  );
  test.each([{ preset: 'meme' }, { customPrompt: 'New instructions' }])(
    'instruction change reuses media/transcript but redetects (%j)',
    async (change) => {
      const f = fixture();
      const first = await f.run();
      const saved = JSON.stringify(first.parent.highlights);
      await f.run(change);
      expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
      expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
      expect(f.discover).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(first.parent.highlights)).toBe(saved);
    },
  );
  test('Free-to-Business reuse selects from the full pool and current authorization', async () => {
    const f = fixture();
    const free = await f.run({ plan: 'free' }),
      paid = await f.run();
    expect(free.parent.clips).toHaveLength(6);
    expect(paid.parent.clips).toHaveLength(9);
    expect(f.discover).toHaveBeenCalledTimes(1);
    const limited = await f.run({ budget: 100 });
    expect(limited.parent.clips).toHaveLength(2);
    expect(limited.parent.highlights).toHaveLength(2);
  });
  test('detection configuration changes invalidate only highlights', async () => {
    const f = fixture();
    await f.run();
    const original = f.detection.cacheConfiguration();
    jest
      .spyOn(f.detection, 'cacheConfiguration')
      .mockReturnValue({ ...original, version: 'new-detection-version' });
    await f.run();
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
    expect(f.discover).toHaveBeenCalledTimes(2);
  });
  test('transcription configuration changes reuse source assets but refresh transcript and detection', async () => {
    const f = fixture();
    await f.run();
    f.transcribe.cacheConfiguration.mockResolvedValue('whisper-settings-v2');
    await f.run();
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(2);
    expect(f.discover).toHaveBeenCalledTimes(2);
  });
  test('transcription failure preserves valid media and releases all cache leases', async () => {
    const f = fixture();
    await f.run();
    f.transcribe.cacheConfiguration.mockResolvedValue('whisper-settings-v2');
    f.transcribe.transcribe.mockRejectedValueOnce(new Error('ASR failed'));
    await expect(f.run()).rejects.toThrow('ASR failed');
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.cache.locks.size).toBe(0);
    await f.run();
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
  });
  test('a first-job ASR failure still publishes reusable valid media', async () => {
    const f = fixture();
    f.transcribe.transcribe.mockRejectedValueOnce(new Error('ASR failed'));
    await expect(f.run()).rejects.toThrow('ASR failed');
    expect(f.source()).not.toBeNull();
    expect(f.cache.rows.size).toBe(0);
    expect(f.cache.locks.size).toBe(0);
    await f.run();
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(2);
  });
  test('missing audio is repaired without redownload, retranscription or redetection', async () => {
    const f = fixture();
    await f.run();
    f.objects.delete(f.source()!.audioObjectKey);
    await f.run();
    expect(f.download.extractAudio).toHaveBeenCalledTimes(1);
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
    expect(f.discover).toHaveBeenCalledTimes(1);
  });
  test.each(['missing', 'corrupt'])('repairs %s media safely', async (mode) => {
    const f = fixture();
    await f.run();
    const key = f.source()!.videoObjectKey;
    if (mode === 'missing') f.objects.delete(key);
    else f.objects.set(key, Buffer.from('corrupt'));
    await f.run();
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(2);
    expect(f.objects.get(key)!.toString()).toBe('video-bytes');
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
  });
  test('concurrent submissions prepare media, transcript and detection only once', async () => {
    const f = fixture();
    const jobs = await Promise.all([f.run(), f.run()]);
    expect(jobs.map((j) => j.parent.clips.length)).toEqual([9, 9]);
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(1);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
    expect(f.discover).toHaveBeenCalledTimes(1);
  });
  test('authenticated sources and custom instructions are isolated by owner', async () => {
    const f = fixture();
    await f.run({ customPrompt: 'Private hint' });
    await f.run({
      customPrompt: 'Private hint',
      owner: '507f1f77bcf86cd799439022',
    });
    expect(f.discover).toHaveBeenCalledTimes(2);
    f.download.canShareSource.mockResolvedValue(false);
    await f.run({ owner: '507f1f77bcf86cd799439022' });
    expect(f.download.downloadVideo).toHaveBeenCalledTimes(2);
  });
  test('resume avoids new discovery; cached jobs settle the current delivered output once', async () => {
    const f = fixture();
    await f.run();
    const second = await f.run();
    await f.processor.process(second.bull as never);
    expect(f.discover).toHaveBeenCalledTimes(1);
    for (const clip of second.parent.clips) {
      clip.status = JobStatus.COMPLETED;
      clip.r2ObjectKey = 'owned-output';
    }
    second.parent.status = JobStatus.COMPLETED;
    await f.jobs.finalizeCredits(second.id);
    await f.jobs.finalizeCredits(second.id);
    expect(f.credits.settle).toHaveBeenCalledTimes(1);
    expect(second.op.charged).toBe(18);
    expect(second.op.charged).toBeLessThanOrEqual(second.op.authorized);
  });
});

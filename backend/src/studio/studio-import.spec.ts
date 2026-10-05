jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { StudioService } from './studio.service';
import type { StudioDocument } from './studio.contract';

describe('Blynta clip to editable Studio project', () => {
  const jobId = '6abe4d644b3ff2840974672f';
  const clipId = '6abe4de08c39dc00dddedd54';
  const key = `clips/${jobId}/clip-1-captioned.mp4`;
  const owner = '507f1f77bcf86cd799439011';
  const body = { jobId, clipId };
  let job: {
    _id: string;
    userId: string;
    clips: {
      _id: Types.ObjectId;
      startTime: number;
      endTime: number;
      r2ObjectKey?: string;
      outputUrl?: string;
      status?: string;
    }[];
    transcript?: { startTime: number; endTime: number; text: string }[];
    highlights: { clipTitle: string }[];
    videoTitle: string;
    thumbnailUrl?: string;
  };
  type ProjectRecord = {
    _id: string;
    userId: string;
    importKey?: string;
    document: StudioDocument;
    revision: number;
    version: number;
    updatedAt: Date;
    save: jest.Mock;
  };
  let savedProjects: ProjectRecord[];
  let savedAssets: Record<string, unknown>[];
  let existingObjects: Set<string>;
  let service: StudioService;
  let projects: { findOne: jest.Mock; create: jest.Mock; deleteOne: jest.Mock };
  let media: { find: jest.Mock; create: jest.Mock; deleteMany: jest.Mock };
  let storage: {
    fileExists: jest.Mock;
    getSignedDownloadUrl: jest.Mock;
    uploadFile: jest.Mock;
    getPresignedUploadUrl: jest.Mock;
  };
  let jobs: { findOne: jest.Mock };
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    savedProjects = [];
    savedAssets = [];
    existingObjects = new Set([key]);
    job = {
      _id: jobId,
      userId: owner,
      videoTitle: 'Source video',
      highlights: [{ clipTitle: 'Generated short' }],
      clips: [
        {
          _id: new Types.ObjectId(clipId),
          startTime: 10,
          endTime: 20,
          r2ObjectKey: key,
          status: 'completed',
        },
      ],
      transcript: [{ startTime: 9, endTime: 12, text: 'Words' }],
    };
    projects = {
      findOne: jest.fn(
        (filter: { userId: string; _id?: string; importKey?: string }) =>
          savedProjects.find(
            (p) =>
              p.userId === filter.userId &&
              (filter._id
                ? p._id === filter._id
                : p.importKey === filter.importKey),
          ) || null,
      ),
      create: jest.fn((input: { userId: string; document: StudioDocument }) => {
        const p: ProjectRecord = {
          ...input,
          _id: String(new Types.ObjectId()),
          revision: 0,
          version: 1,
          updatedAt: new Date(),
          save: jest.fn(),
        };
        p.save.mockImplementation(() => {
          if (
            savedProjects.some(
              (other) =>
                other !== p &&
                other.userId === p.userId &&
                other.importKey === p.importKey,
            )
          )
            throw Object.assign(new Error('duplicate'), { code: 11000 });
          return p;
        });
        savedProjects.push(p);
        return p;
      }),
      deleteOne: jest.fn((filter: { _id: string }) => {
        savedProjects = savedProjects.filter((p) => p._id !== filter._id);
      }),
    };
    media = {
      find: jest.fn((filter: { userId: string; projectId: string }) =>
        savedAssets.filter(
          (a) => a.userId === filter.userId && a.projectId === filter.projectId,
        ),
      ),
      create: jest.fn((input: Record<string, unknown>) => {
        savedAssets.push(input);
        return input;
      }),
      deleteMany: jest.fn((filter: { projectId: string }) => {
        savedAssets = savedAssets.filter(
          (a) => a.projectId !== filter.projectId,
        );
      }),
    };
    jobs = {
      findOne: jest.fn((filter: { _id: string; userId: string }) =>
        filter._id === job._id && filter.userId === job.userId ? job : null,
      ),
    };
    storage = {
      fileExists: jest.fn((objectKey: string) =>
        existingObjects.has(objectKey),
      ),
      getSignedDownloadUrl: jest.fn(
        (objectKey: string) =>
          `https://playback.invalid/${objectKey}?signed=temporary`,
      ),
      uploadFile: jest.fn(),
      getPresignedUploadUrl: jest.fn(),
    };
    service = new StudioService(
      projects as never,
      media as never,
      {} as never,
      jobs as never,
      { findById: jest.fn() } as never,
      { add: jest.fn() } as never,
      storage as never,
      {} as never,
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses the supplied real-format IDs, an existing R2 object and an editable initial timeline', async () => {
    const result = await service.fromClip(owner, body);
    expect(jobs.findOne).toHaveBeenCalledWith({ _id: jobId, userId: owner });
    expect(result.name).toBe('Generated short');
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]).toMatchObject({
      assetId: result.assets[0].id,
      duration: 10,
      start: 0,
      offset: 0,
      trackId: 'video',
    });
    expect((result.assets[0] as { src?: string }).src).toContain(key);
    expect(savedAssets[0]).toMatchObject({
      storageKey: key,
      status: 'ready',
      userId: owner,
      transcript: [{ startTime: 0, endTime: 2, text: 'Words' }],
    });
    expect(JSON.stringify(savedProjects[0].document)).not.toContain('signed=');
    expect(JSON.stringify(savedAssets)).not.toContain('signed=');
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(storage.getPresignedUploadUrl).not.toHaveBeenCalled();
    // The same server-owned reference also passes normal timeline validation.
    await expect(
      service.validateAssets(owner, result.id, savedProjects[0].document),
    ).resolves.toBeUndefined();
  });
  it('resolves legacy outputUrl keys and missing transcripts without uploading', async () => {
    delete job.clips[0].r2ObjectKey;
    job.clips[0].outputUrl = key;
    delete job.transcript;
    const result = await service.fromClip(owner, body);
    expect((result.assets[0] as { src?: string }).src).toContain(key);
    expect(savedAssets[0].storageKey).toBe(key);
  });
  it('recovers the documented legacy object name while never persisting an expired URL', async () => {
    delete job.clips[0].r2ObjectKey;
    job.clips[0].outputUrl = 'https://expired.invalid/video.mp4?token=secret';
    await service.fromClip(owner, body);
    expect(storage.fileExists).toHaveBeenCalledWith(key);
    expect(JSON.stringify(savedAssets)).not.toContain('secret');
  });
  it('never resolves a legacy key under another job namespace', async () => {
    delete job.clips[0].r2ObjectKey;
    job.clips[0].outputUrl = 'clips/other-job/private.mp4';
    existingObjects = new Set([job.clips[0].outputUrl]);
    await expect(service.fromClip(owner, body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.fileExists).not.toHaveBeenCalledWith(job.clips[0].outputUrl);
    expect(projects.create).not.toHaveBeenCalled();
  });
  it('returns 404 for nonexistent or other-owner clips before signing or creating', async () => {
    await expect(
      service.fromClip(owner, { ...body, clipId: '507f1f77bcf86cd799439022' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.fromClip('another-user', body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(projects.create).not.toHaveBeenCalled();
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
  it('refuses missing objects, unfinished clips, invalid IDs and forged ownership', async () => {
    existingObjects.clear();
    await expect(service.fromClip(owner, body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    job.clips[0].status = 'pending';
    await expect(service.fromClip(owner, body)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.fromClip(owner, { ...body, clipId: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.fromClip(owner, { ...body, userId: owner }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(projects.create).not.toHaveBeenCalled();
  });
  it('reports storage authentication or connectivity failures as unavailable, not missing media', async () => {
    storage.fileExists.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(service.fromClip(owner, body)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(projects.create).not.toHaveBeenCalled();
  });
  it('reopens an initialized project on repeated clicks without another import', async () => {
    const first = await service.fromClip(owner, body);
    const second = await service.fromClip(owner, body);
    expect(second.id).toBe(first.id);
    expect(projects.create).toHaveBeenCalledTimes(1);
    expect(media.create).toHaveBeenCalledTimes(1);
  });
  it('normalizes ObjectId case for deterministic lookup and reuse', async () => {
    const first = await service.fromClip(owner, body);
    const second = await service.fromClip(owner, {
      jobId: jobId.toUpperCase(),
      clipId: clipId.toUpperCase(),
    });
    expect(second.id).toBe(first.id);
  });
  it('resolves concurrent requests to one fully initialized imported project', async () => {
    const [first, second] = await Promise.all([
      service.fromClip(owner, body),
      service.fromClip(owner, body),
    ]);
    expect(first.id).toBe(second.id);
    expect(savedProjects).toHaveLength(1);
    expect(savedAssets).toHaveLength(1);
    expect(first.clips).toHaveLength(1);
  });
  it('cleans incomplete projects after an asset-write failure', async () => {
    media.create.mockRejectedValueOnce(new Error('database write failed'));
    await expect(service.fromClip(owner, body)).rejects.toThrow(
      'database write failed',
    );
    expect(savedProjects).toHaveLength(0);
    expect(savedAssets).toHaveLength(0);
  });
  it('returns source thumbnails for existing imports without persisting temporary URLs', async () => {
    job.thumbnailUrl = 'https://i.ytimg.com/vi/example/hqdefault.jpg';
    const imported = await service.fromClip(owner, body);
    expect(imported.assets[0].thumbnail).toBe(job.thumbnailUrl);
    expect((await service.get(owner, imported.id)).assets[0].thumbnail).toBe(
      job.thumbnailUrl,
    );
    expect(savedProjects[0].document.assets[0]).not.toHaveProperty('thumbnail');
    expect(jobs.findOne).toHaveBeenCalledWith(
      { _id: jobId, userId: owner },
      { thumbnailUrl: 1 },
    );
  });
  it('prefers stored thumbnails over the source poster', async () => {
    job.thumbnailUrl = 'https://i.ytimg.com/vi/example/hqdefault.jpg';
    const imported = await service.fromClip(owner, body);
    savedAssets[0].thumbnailKey = 'studio/cover.jpg';
    const project = await service.get(owner, imported.id);
    expect(project.assets[0].thumbnail).toBe(
      'https://playback.invalid/studio/cover.jpg?signed=temporary',
    );
  });
  it('ignores unsafe source thumbnail URLs', async () => {
    job.thumbnailUrl = 'javascript:alert(1)';
    const imported = await service.fromClip(owner, body);
    expect(imported.assets[0].thumbnail).toBeUndefined();
  });
  it('returns thumbnails in the dashboard list for previously imported projects', async () => {
    job.thumbnailUrl = 'https://i.ytimg.com/vi/example/hqdefault.jpg';
    await service.fromClip(owner, body);
    Object.assign(projects, {
      find: jest.fn(() => ({ sort: () => ({ limit: () => savedProjects }) })),
    });
    media.find.mockReturnValue(savedAssets);
    const listed = await service.list(owner);
    expect(listed[0].assets[0].thumbnail).toBe(job.thumbnailUrl);
    jobs.findOne.mockReturnValue(null);
    expect((await service.list(owner))[0].assets[0]).not.toHaveProperty(
      'thumbnail',
    );
  });
});

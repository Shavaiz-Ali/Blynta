jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StudioService } from './studio.service';
import {
  defaultTracks,
  documentSchema,
  makeClip,
  parse,
} from './studio.contract';

describe('Studio persistence and ownership', () => {
  const projectId = '507f1f77bcf86cd799439011';
  const asset = {
    id: 'media-1',
    name: 'Footage',
    kind: 'video' as const,
    duration: 10,
    origin: 'Upload' as const,
  };
  const document = {
    name: 'Project',
    ratio: '16:9' as const,
    tracks: defaultTracks,
    assets: [asset],
    clips: [makeClip(asset)],
  };
  const project = {
    _id: projectId,
    userId: 'alice',
    revision: 2,
    document,
    updatedAt: new Date(),
  };
  let service: StudioService;
  let projects: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let media: {
    find: jest.Mock;
    findOne: jest.Mock;
    countDocuments: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
  };
  let storage: {
    fileExists: jest.Mock;
    objectInfo: jest.Mock;
    getPresignedUploadUrl: jest.Mock;
    getSignedDownloadUrl: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let jobs: { findOne: jest.Mock };
  let sources: { findById: jest.Mock };
  beforeEach(() => {
    projects = {
      create: jest.fn(),
      findOne: jest.fn(({ userId }) => (userId === 'alice' ? project : null)),
      findOneAndUpdate: jest.fn(({ revision }) =>
        revision === 2 ? { ...project, revision: 3 } : null,
      ),
    };
    media = {
      find: jest.fn(() => [
        {
          ...asset,
          assetId: asset.id,
          userId: 'alice',
          projectId,
          status: 'ready',
        },
      ]),
      findOne: jest.fn(() => null),
      countDocuments: jest.fn(() => 0),
      create: jest.fn(),
      updateOne: jest.fn(),
    };
    storage = {
      fileExists: jest.fn(() => true),
      objectInfo: jest.fn(),
      getPresignedUploadUrl: jest.fn(() => 'signed-put'),
      getSignedDownloadUrl: jest.fn(() => 'signed-get'),
    };
    queue = { add: jest.fn() };
    jobs = { findOne: jest.fn(() => null) };
    sources = { findById: jest.fn(() => null) };
    service = new StudioService(
      projects as never,
      media as never,
      {} as never,
      jobs as never,
      sources as never,
      queue as never,
      storage as never,
      {} as never,
    );
  });
  it('refuses another owner and malformed IDs without exposing media', async () => {
    await expect(service.get('bob', projectId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.get('alice', 'bad-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
  it('updates with compare-and-swap revision', async () => {
    expect(
      await service.save('alice', projectId, {
        version: 1,
        revision: 2,
        document,
      }),
    ).toMatchObject({ revision: 3 });
    expect(projects.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: projectId, userId: 'alice', revision: 2 },
      expect.objectContaining({ $inc: { revision: 1 } }),
      { new: true },
    );
    await expect(
      service.save('alice', projectId, { version: 1, revision: 1, document }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects foreign media references and forged durations', async () => {
    media.find.mockResolvedValue([]);
    await expect(
      service.save('alice', projectId, { version: 1, revision: 2, document }),
    ).rejects.toBeInstanceOf(BadRequestException);
    media.find.mockResolvedValue([
      { assetId: asset.id, kind: 'video', duration: 3 },
    ]);
    await expect(
      service.save('alice', projectId, { version: 1, revision: 2, document }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(projects.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('never accepts browser-supplied storage keys, URLs, or user IDs', async () => {
    const upload = { name: 'footage.mp4', mimeType: 'video/mp4', size: 100 };
    for (const extra of [
      { storageKey: 'other-user/secret' },
      { userId: 'bob' },
      { src: 'https://untrusted.invalid' },
    ]) {
      await expect(
        service.upload('alice', projectId, { ...upload, ...extra }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await service.upload('alice', projectId, upload);
    expect(media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        storageKey: expect.stringMatching(
          new RegExp(`^studio/alice/${projectId}/assets/`),
        ),
        userId: 'alice',
      }),
    );
  });
  it('checks uploaded object metadata before scheduling processing', async () => {
    media.findOne.mockResolvedValue({
      _id: 'asset',
      assetId: 'd4057c3f-55dd-4591-840b-ffeed16b0c99',
      storageKey: 'server-key',
      size: 100,
      mimeType: 'video/mp4',
      status: 'pending',
    });
    storage.objectInfo.mockResolvedValue({
      size: 101,
      contentType: 'video/mp4',
    });
    await expect(
      service.complete('alice', projectId, {
        assetId: 'd4057c3f-55dd-4591-840b-ffeed16b0c99',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('does not import another user’s generated clip', async () => {
    await expect(
      service.fromClip('bob', { jobId: projectId, clipId: projectId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('reuses owned clip and source R2 keys, cached transcript, and an initialized project', async () => {
    const imported = {
      ...project,
      document: { ...document, assets: [], clips: [] },
      save: jest.fn(),
      importKey: undefined as string | undefined,
    };
    projects.findOne.mockImplementation((filter: { importKey?: string }) =>
      filter.importKey ? (imported.importKey ? imported : null) : imported,
    );
    projects.create.mockImplementation((input: typeof imported) =>
      Object.assign(imported, input),
    );
    jobs.findOne.mockResolvedValue({
      videoTitle: 'Owned clip',
      sourceVideoId: 'source-id',
      clips: [
        {
          _id: projectId,
          r2ObjectKey: 'existing-clip-key',
          startTime: 10,
          endTime: 14,
        },
      ],
      transcript: [
        { startTime: 9, endTime: 12, text: 'First words' },
        { startTime: 13, endTime: 15, text: 'Last words' },
      ],
    });
    sources.findById.mockResolvedValue({
      videoObjectKey: 'existing-source-key',
      videoDuration: 30,
      transcript: [],
    });
    const stored: Record<string, unknown>[] = [];
    media.create.mockImplementation((input: Record<string, unknown>) => {
      stored.push(input);
      return input;
    });
    media.find.mockImplementation(() => stored);
    const first = await service.fromClip('alice', {
      jobId: projectId,
      clipId: projectId,
    });
    const second = await service.fromClip('alice', {
      jobId: projectId,
      clipId: projectId,
    });
    expect(first.id).toBe(second.id);
    expect(first.clips).toHaveLength(1);
    expect(first.assets).toHaveLength(2);
    expect(first.clips[0].duration).toBe(4);
    expect(projects.create).toHaveBeenCalledTimes(1);
    expect(stored.map((a) => a.storageKey)).toEqual([
      'existing-clip-key',
      'existing-source-key',
    ]);
    expect(stored[0].transcript).toEqual([
      { startTime: 0, endTime: 2, text: 'First words' },
      { startTime: 3, endTime: 4, text: 'Last words' },
    ]);
    expect(storage.getPresignedUploadUrl).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('maps cached transcript into trimmed and retimed timeline captions', async () => {
    media.findOne.mockResolvedValue({
      transcript: [{ startTime: 1, endTime: 5, text: 'Actual source words' }],
    });
    const doc = {
      ...document,
      clips: [
        { ...document.clips[0], start: 3, duration: 4, offset: 2, speed: 2 },
      ],
    };
    const proposal = await service.propose('alice', projectId, {
      prompt: 'Add captions',
      document: doc,
    });
    expect(proposal.actions).toEqual([
      {
        type: 'captions',
        segments: [{ start: 3, end: 4.5, text: 'Actual source words' }],
      },
    ]);
    expect(queue.add).not.toHaveBeenCalled();
    expect(projects.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('validates timeline structure, finite numbers, references, and bounds', () => {
    expect(() => parse(documentSchema, document)).not.toThrow();
    for (const patch of [
      { assetId: 'unknown' },
      { trackId: 'missing' },
      { scale: NaN },
      { offset: 50 },
      { duration: 4000 },
    ]) {
      expect(() =>
        parse(documentSchema, {
          ...document,
          clips: [{ ...document.clips[0], ...patch }],
        }),
      ).toThrow();
    }
    expect(() =>
      parse(documentSchema, {
        ...document,
        tracks: [...defaultTracks, defaultTracks[0]],
      }),
    ).toThrow();
  });
});

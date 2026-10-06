jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
import { BadRequestException } from '@nestjs/common';
import { StudioService } from './studio.service';

describe('Studio account media library', () => {
  function fixture() {
    const projects = {
      find: jest.fn(() => ({
        lean: () => Promise.resolve([{ _id: 'owned-project' }]),
      })),
    };
    const records = [
      {
        _id: 'record',
        assetId: 'asset',
        projectId: 'owned-project',
        storageKey: 'persistent/key',
        name: 'Footage',
        kind: 'image',
        duration: 0,
        status: 'ready',
        sourceGroup: 'Uploads',
      },
    ];
    const cursor = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(records),
    };
    const media = {
      find: jest.fn(() => cursor),
      countDocuments: jest.fn(() => Promise.resolve(30)),
    };
    const storage = {
      getSignedDownloadUrl: jest.fn(() =>
        Promise.resolve('https://storage.example/temporary'),
      ),
    };
    const service = new StudioService(
      projects as never,
      media as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      storage as never,
      {} as never,
    );
    return { service, projects, media, storage, cursor, records };
  }
  it('scopes both records and totals to the user and their existing projects', async () => {
    const { service, projects, media, cursor } = fixture();
    const result = await service.library('alice', {
      page: '2',
      source: 'uploads',
    });
    expect(projects.find).toHaveBeenCalledWith({ userId: 'alice' }, { _id: 1 });
    const filter = {
      userId: 'alice',
      projectId: { $in: ['owned-project'] },
      sourceGroup: 'Uploads',
    };
    expect(media.find).toHaveBeenCalledWith(filter);
    expect(media.countDocuments).toHaveBeenCalledWith(filter);
    expect(cursor.skip).toHaveBeenCalledWith(24);
    expect(cursor.limit).toHaveBeenCalledWith(24);
    expect(result).toMatchObject({ total: 30, page: 2, totalPages: 2 });
  });
  it('signs previews from stored keys without exposing keys or modifying records', async () => {
    const { service, storage, records } = fixture();
    const result = await service.library('alice', {});
    expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('persistent/key');
    expect(result.items[0].thumbnail).toBe('https://storage.example/temporary');
    expect(result.items[0]).not.toHaveProperty('storageKey');
    expect(records[0]).not.toHaveProperty('thumbnail');
  });
  it('filters imported media and rejects unsupported filters or invalid pages', async () => {
    const { service, media } = fixture();
    await service.library('alice', { source: 'blynta' });
    expect(media.find).toHaveBeenCalledWith(
      expect.objectContaining({ sourceGroup: { $ne: 'Uploads' } }),
    );
    for (const query of [{ page: 0 }, { page: 1.5 }, { source: 'other' }]) {
      await expect(service.library('alice', query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
});

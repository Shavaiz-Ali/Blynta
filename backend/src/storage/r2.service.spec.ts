import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { R2Service } from './r2.service';

describe('R2 object existence', () => {
  afterEach(() => jest.restoreAllMocks());
  const service = () =>
    new R2Service(
      new ConfigService({
        R2_BUCKET_NAME: 'test',
        R2_ENDPOINT: 'https://storage.invalid',
        R2_ACCESS_KEY_ID: 'test',
        R2_SECRET_ACCESS_KEY: 'test',
      }),
    );
  it('confirms a successful HEAD', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    await expect(service().fileExists('clips/owned/clip.mp4')).resolves.toBe(
      true,
    );
  });
  it('returns false only for a missing object', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(
      Object.assign(new Error('NotFound'), {
        $metadata: { httpStatusCode: 404 },
      }) as never,
    );
    await expect(service().fileExists('clips/owned/missing.mp4')).resolves.toBe(
      false,
    );
  });
  it.each([
    Object.assign(new Error('AccessDenied'), {
      $metadata: { httpStatusCode: 403 },
    }),
    new Error('Connection refused'),
  ])(
    'preserves storage failures instead of claiming the clip is missing',
    async (failure) => {
      jest
        .spyOn(S3Client.prototype, 'send')
        .mockRejectedValue(failure as never);
      await expect(service().fileExists('clips/owned/clip.mp4')).rejects.toBe(
        failure,
      );
    },
  );

  it('keeps source artifacts in a separate private bucket', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const storage = new R2Service(
      new ConfigService({
        R2_BUCKET_NAME: 'public-clips',
        R2_SOURCE_BUCKET_NAME: 'private-sources',
        R2_PUBLIC_DOMAIN: 'https://clips.invalid',
        R2_ENDPOINT: 'https://storage.invalid',
        R2_ACCESS_KEY_ID: 'test',
        R2_SECRET_ACCESS_KEY: 'test',
      }),
    );
    await storage.fileExists('source-videos/hash/video.mp4');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: 'private-sources' }),
      }),
    );
    const sign = jest
      .spyOn(storage, 'getSignedDownloadUrl')
      .mockResolvedValue('https://signed.invalid/source');
    expect(
      await storage.getPublicOrSignedUrl('source-videos/hash/video.mp4'),
    ).toBe('https://signed.invalid/source');
    expect(sign).toHaveBeenCalled();
    expect(await storage.getPublicOrSignedUrl('clips/job/clip.mp4')).toBe(
      'https://clips.invalid/clips/job/clip.mp4',
    );
  });

  it('refuses to publish source files into a configured public bucket', async () => {
    const storage = new R2Service(
      new ConfigService({
        R2_BUCKET_NAME: 'public-clips',
        R2_PUBLIC_DOMAIN: 'https://clips.invalid',
        R2_ENDPOINT: 'https://storage.invalid',
        R2_ACCESS_KEY_ID: 'test',
        R2_SECRET_ACCESS_KEY: 'test',
      }),
    );
    await expect(
      storage.fileExists('source-videos/hash/video.mp4'),
    ).rejects.toThrow('R2_SOURCE_BUCKET_NAME');
  });
});

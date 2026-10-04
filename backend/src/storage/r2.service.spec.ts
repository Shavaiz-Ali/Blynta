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
});

import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { R2Service } from './r2.service';
import { Readable } from 'node:stream';
import { UnrecoverableError } from 'bullmq';

describe('R2 credential configuration', () => {
  const valid = {
    R2_ACCESS_KEY_ID: '1'.repeat(32),
    R2_SECRET_ACCESS_KEY: '2'.repeat(64),
  };
  const storage = {
    R2_BUCKET_NAME: 'blynta',
    R2_SOURCE_BUCKET_NAME: 'blynta',
    R2_ENDPOINT: 'https://storage.invalid',
  };
  const names = [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
  ] as const;
  let previous: Record<string, string | undefined>;
  beforeEach(() => {
    previous = Object.fromEntries(
      names.map((name) => [name, process.env[name]]),
    );
    for (const name of names) delete process.env[name];
  });
  afterEach(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    jest.restoreAllMocks();
  });
  it.each(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const)(
    'rejects missing, empty and invalid %s before any S3 operation without exposing values',
    (name) => {
      const send = jest.spyOn(S3Client.prototype, 'send');
      for (const invalid of [
        undefined,
        '',
        '   ',
        null,
        123,
        ' confidential-value ',
      ]) {
        let failure: unknown;
        try {
          new R2Service(
            new ConfigService({ ...storage, ...valid, [name]: invalid }),
          );
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(UnrecoverableError);
        const message = (failure as Error).message;
        expect(message).toContain(name);
        for (const value of [
          valid.R2_ACCESS_KEY_ID,
          valid.R2_SECRET_ACCESS_KEY,
          'confidential-value',
        ])
          expect(message).not.toContain(value);
      }
      expect(send).not.toHaveBeenCalled();
    },
  );
  it('uses injected R2 environment credentials unchanged, independently of AWS role credentials', async () => {
    Object.assign(process.env, valid, {
      AWS_ACCESS_KEY_ID: 'AWS_TEST_ACCESS_KEY',
      AWS_SECRET_ACCESS_KEY: 'aws-test-secret',
      AWS_SESSION_TOKEN: 'aws-test-session',
    });
    const r2 = new R2Service(new ConfigService(storage));
    const client = Reflect.get(r2, 'client') as S3Client;
    try {
      const credentials = await client.config.credentials();
      expect(credentials.accessKeyId).toBe(valid.R2_ACCESS_KEY_ID);
      expect(credentials.secretAccessKey).toBe(valid.R2_SECRET_ACCESS_KEY);
      expect(credentials.sessionToken).toBeUndefined();
      expect(process.env.AWS_ACCESS_KEY_ID).toBe('AWS_TEST_ACCESS_KEY');
      expect(process.env.AWS_SESSION_TOKEN).toBe('aws-test-session');
      expect(await client.config.region()).toBe('auto');
    } finally {
      client.destroy();
    }
  });
  it('does not fall back to AWS credentials when R2 variables are absent', () => {
    Object.assign(process.env, {
      AWS_ACCESS_KEY_ID: 'AWS_TEST_ACCESS_KEY',
      AWS_SECRET_ACCESS_KEY: 'aws-test-secret',
    });
    expect(() => new R2Service(new ConfigService(storage))).toThrow(
      'R2_ACCESS_KEY_ID',
    );
  });
  it('does not replace an explicitly empty R2 setting with another credential source', () => {
    Object.assign(process.env, valid);
    expect(
      () =>
        new R2Service(new ConfigService({ ...storage, R2_ACCESS_KEY_ID: '' })),
    ).toThrow('R2_ACCESS_KEY_ID');
  });
});

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
  it('bounds private renderer manifest buffers', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
      Body: Readable.from([Buffer.from('too large')]),
    } as never);
    await expect(
      service().downloadToBuffer('job-sources/batch/task.json', 3),
    ).rejects.toThrow('buffer budget');
  });
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
        input: expect.objectContaining({
          Bucket: 'private-sources',
        }) as unknown,
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
  it.each([
    ['blynta', 'blynta'],
    ['output', 'private-sources'],
  ])(
    'routes existing keys and Batch artifacts consistently for %s/%s',
    async (output, source) => {
      const send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(
        () =>
          Promise.resolve({
            Body: Readable.from([Buffer.from('source')]),
          }) as never,
      );
      const storage = new R2Service(
        new ConfigService({
          R2_BUCKET_NAME: output,
          R2_SOURCE_BUCKET_NAME: source,
          R2_ENDPOINT: 'https://storage.invalid',
          R2_ACCESS_KEY_ID: 'test',
          R2_SECRET_ACCESS_KEY: 'test',
        }),
      );
      for (const key of [
        'source-videos/existing/video.mp4',
        'job-sources/old/video.mp4',
      ]) {
        expect((await storage.downloadToBuffer(key)).toString()).toBe('source');
        expect(send).toHaveBeenLastCalledWith(
          expect.objectContaining({ input: { Bucket: source, Key: key } }),
        );
      }
      for (const key of [
        'job-sources/batch/hash/task.json',
        'job-sources/batch/hash/inputs/source.mp4',
        'job-sources/batch/hash/progress.json',
        'job-sources/batch/hash/result.json',
        'job-sources/batch/hash/output.mp4',
        'clips/job/clip-captioned.mp4',
      ]) {
        await storage.uploadBuffer(Buffer.from('test'), key);
        expect(send).toHaveBeenLastCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              Bucket: key.startsWith('clips/') ? output : source,
              Key: key,
            }) as unknown,
          }),
        );
      }
      const sign = jest
        .spyOn(storage, 'getSignedDownloadUrl')
        .mockResolvedValue('https://signed.invalid/private');
      await storage.getPublicOrSignedUrl('source-videos/existing/video.mp4');
      await storage.getPublicOrSignedUrl('clips/job/clip-captioned.mp4');
      expect(sign).toHaveBeenCalledTimes(2);
    },
  );
  it('keeps the shared-public-bucket privacy guard permanent', async () => {
    const storage = new R2Service(
      new ConfigService({
        R2_BUCKET_NAME: 'blynta',
        R2_SOURCE_BUCKET_NAME: 'blynta',
        R2_PUBLIC_DOMAIN: 'https://public.invalid',
        R2_ENDPOINT: 'https://storage.invalid',
        R2_ACCESS_KEY_ID: 'test',
        R2_SECRET_ACCESS_KEY: 'test',
      }),
    );
    await expect(
      storage.fileExists('source-videos/existing/video.mp4'),
    ).rejects.toBeInstanceOf(UnrecoverableError);
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

import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { R2Service } from './r2.service';
import { r2FailureDetails } from './r2-diagnostics';

const endpoint =
  'https://add75aeac145699c8f5d04fa5abacbf5.r2.cloudflarestorage.com';
const access = '1'.repeat(32);
const secret = '2'.repeat(64);
const makeStorage = (source = 'blynta') =>
  new R2Service(
    new ConfigService({
      R2_BUCKET_NAME: 'blynta',
      R2_SOURCE_BUCKET_NAME: source,
      R2_ENDPOINT: endpoint,
      R2_ACCESS_KEY_ID: access,
      R2_SECRET_ACCESS_KEY: secret,
    }),
  );
type Request = {
  method: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
};

describe('real R2 SDK signing (offline transport, no mocked signer)', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(['blynta', 'private-sources'])(
    'uses SigV4, auto region and account endpoint for source bucket %s and output bucket blynta',
    async (sourceBucket) => {
      const storage = makeStorage(sourceBucket);
      const client = Reflect.get(storage, 'client') as S3Client;
      const requests: Request[] = [];
      client.config.requestHandler = {
        handle: (request: Request) => {
          requests.push(request);
          return Promise.resolve({
            response: {
              statusCode: 200,
              headers: { 'content-length': '2' },
              body: Readable.from([Buffer.from('{}')]),
            },
          });
        },
      };
      const directory = await mkdtemp(join(tmpdir(), 'r2-signing-'));
      try {
        await storage.downloadToBuffer('job-sources/batch/test/task.json');
        await storage.objectInfo('source-videos/existing/video.mp4');
        await storage.downloadToLocal(
          'job-sources/batch/test/inputs/source.mp4',
          join(directory, 'input.mp4'),
        );
        await storage.uploadBuffer(
          Buffer.from('{}'),
          'job-sources/batch/test/progress.json',
          'application/json',
        );
        await writeFile(join(directory, 'output.mp4'), 'video');
        await storage.uploadFile(
          join(directory, 'output.mp4'),
          'job-sources/batch/test/output.mp4',
        );
        await storage.uploadBuffer(
          Buffer.from('{}'),
          'job-sources/batch/test/result.json',
          'application/json',
        );
        await storage.uploadFile(
          join(directory, 'output.mp4'),
          'clips/test/clip.mp4',
        );
        expect(requests).toHaveLength(7);
        for (const request of requests) {
          expect(request.hostname).toBe(new URL(endpoint).hostname);
          expect(request.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
          expect(request.headers.authorization).toContain(
            '/auto/s3/aws4_request',
          );
          expect(request.headers['x-amz-security-token']).toBeUndefined();
        }
        expect(requests.map(({ path }) => path)).toEqual([
          `/${sourceBucket}/job-sources/batch/test/task.json`,
          `/${sourceBucket}/source-videos/existing/video.mp4`,
          `/${sourceBucket}/job-sources/batch/test/inputs/source.mp4`,
          `/${sourceBucket}/job-sources/batch/test/progress.json`,
          `/${sourceBucket}/job-sources/batch/test/output.mp4`,
          `/${sourceBucket}/job-sources/batch/test/result.json`,
          '/blynta/clips/test/clip.mp4',
        ]);
        expect(requests[4].headers['content-encoding']).not.toBe('aws-chunked');
        for (const [signed, bucket] of [
          [
            await storage.getSignedDownloadUrl(
              'source-videos/existing/video.mp4',
            ),
            sourceBucket,
          ],
          [
            await storage.getPresignedUploadUrl(
              'clips/test/clip.mp4',
              'video/mp4',
            ),
            'blynta',
          ],
        ]) {
          const url = new URL(signed);
          expect(url.hostname).toBe(new URL(endpoint).hostname);
          expect(url.pathname.startsWith(`/${bucket}/`)).toBe(true);
          expect(url.searchParams.get('X-Amz-Algorithm')).toBe(
            'AWS4-HMAC-SHA256',
          );
          expect(url.searchParams.get('X-Amz-Credential')).toMatch(
            new RegExp(`^${access}/[0-9]{8}/auto/s3/aws4_request$`),
          );
          expect(url.searchParams.has('X-Amz-Signature')).toBe(true);
          expect(url.searchParams.has('AWSAccessKeyId')).toBe(false);
        }
      } finally {
        client.destroy();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it('reports the real failing SDK operation and safe metadata, preserving the exception', async () => {
    const logs = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const storage = makeStorage();
    const client = Reflect.get(storage, 'client') as S3Client;
    client.config.requestHandler = {
      handle: () =>
        Promise.resolve({
          response: {
            statusCode: 400,
            headers: {
              'content-type': 'application/xml',
              'x-amz-request-id': 'safe-request-id',
            },
            body: Readable.from([
              Buffer.from(
                '<Error><Code>InvalidRequest</Code><Message>Please use AWS4-HMAC-SHA256</Message></Error>',
              ),
            ]),
          },
        }),
    };
    try {
      await expect(
        storage.downloadToBuffer('job-sources/batch/test/task.json'),
      ).rejects.toMatchObject({
        name: 'InvalidRequest',
        $metadata: { httpStatusCode: 400, requestId: 'safe-request-id' },
      });
      const entry = JSON.parse(logs.mock.calls[0][0] as string) as Record<
        string,
        unknown
      >;
      expect(entry).toMatchObject({
        event: 'r2_operation_failed',
        operation: 'GetObjectCommand',
        endpointHttps: true,
        endpointIsR2: true,
        region: 'auto',
        forcePathStyle: true,
        exceptionType: 'InvalidRequest',
        message: 'Please use AWS4-HMAC-SHA256',
        httpStatusCode: 400,
        requestId: 'safe-request-id',
        requestSignedWithV4: true,
        requestUsesConfiguredEndpoint: true,
      });
      expect(JSON.stringify(entry)).not.toContain(access);
      expect(JSON.stringify(entry)).not.toContain(secret);
      expect(entry).not.toHaveProperty('request');
    } finally {
      client.destroy();
    }
  });
  it('redacts credentials, signed URLs and authorization material from allowlisted fields', () => {
    const diagnostic = JSON.stringify(
      r2FailureDetails(
        Object.assign(
          new Error(
            `Invalid ${access} ${secret} https://storage.invalid/a?X-Amz-Signature=secret Authorization=hidden`,
          ),
          {
            $metadata: { httpStatusCode: 403, requestId: 'safe-id' },
            request: { secret },
          },
        ),
        [access, secret],
      ),
    );
    for (const value of [
      access,
      secret,
      'https://',
      'X-Amz-Signature',
      'hidden',
    ])
      expect(diagnostic).not.toContain(value);
    expect(diagnostic).toContain('safe-id');
  });
});

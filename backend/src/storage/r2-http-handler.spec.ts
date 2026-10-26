import { Agent, createServer, type Server } from 'node:https';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage } from 'node:http';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  type ServiceInputTypes,
  type ServiceOutputTypes,
} from '@aws-sdk/client-s3';
import type { FinalizeRequestMiddleware } from '@smithy/types';
import { UnrecoverableError } from 'bullmq';
import { R2Service } from './r2.service';
import { R2HttpHandler } from './r2-http-handler';
import { runRenderer } from '../batch-render/renderer';

const access = '1'.repeat(32),
  secret = '2'.repeat(64);
const prefix = `job-sources/batch/${'a'.repeat(64)}`;
const key = `${prefix}/task.json`;
// Independent verification of the bytes received by the HTTPS server, not a mocked signer.
function signatureValid(request: IncomingMessage, body: Buffer) {
  const auth =
    /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([a-f0-9]{64})$/.exec(
      request.headers.authorization ?? '',
    );
  if (!auth || auth[1] !== access) return false;
  const url = new URL(request.url!, 'https://localhost');
  const encode = (value: string) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  const query = [...url.searchParams]
    .map(([name, value]) => [encode(name), encode(value)])
    .sort(([a, b], [c, d]) =>
      a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0,
    )
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
  const headers = auth[3]
    .split(';')
    .map(
      (name) =>
        `${name}:${String(request.headers[name] ?? '')
          .trim()
          .replace(/\s+/g, ' ')}\n`,
    )
    .join('');
  const sha = (value: string | Buffer) =>
    createHash('sha256').update(value).digest('hex');
  const payload = String(request.headers['x-amz-content-sha256'] ?? sha(body));
  const canonical = [
    request.method,
    url.pathname,
    query,
    headers,
    auth[3],
    payload,
  ].join('\n');
  const scope = `${auth[2]}/auto/s3/aws4_request`;
  const sign = (key: string | Buffer, value: string) =>
    createHmac('sha256', key).update(value).digest();
  const derived = sign(
    sign(sign(sign(`AWS4${secret}`, auth[2]), 'auto'), 's3'),
    'aws4_request',
  );
  return (
    sign(
      derived,
      [
        'AWS4-HMAC-SHA256',
        request.headers['x-amz-date'],
        scope,
        sha(canonical),
      ].join('\n'),
    ).toString('hex') === auth[4]
  );
}

describe('R2 final Node HTTPS request boundary', () => {
  let server: Server,
    endpoint: string,
    logs: Record<string, unknown>[],
    clients: S3Client[];
  let mode: 'ok' | '400' | '403' | '404' | '503' | 'redirect';
  let errorLog: jest.SpyInstance;
  let received: {
    method?: string;
    path: string;
    validSignature: boolean;
    sessionToken: boolean;
  }[];
  const cert = readFileSync(
    join(__dirname, '../../test/fixtures/r2-loopback-cert.pem'),
  );
  beforeEach(async () => {
    logs = [];
    clients = [];
    received = [];
    mode = 'ok';
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        if (typeof message === 'string' && message.startsWith('{'))
          logs.push(JSON.parse(message) as Record<string, unknown>);
      });
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    server = createServer(
      {
        cert,
        key: readFileSync(
          join(__dirname, '../../test/fixtures/r2-loopback-key.pem'),
        ),
      },
      (request, response) => {
        void (async () => {
          const chunks: Buffer[] = [];
          for await (const chunk of request)
            chunks.push(Buffer.from(chunk as Uint8Array));
          received.push({
            method: request.method,
            path: request.url!.split('?')[0],
            validSignature: signatureValid(request, Buffer.concat(chunks)),
            sessionToken: !!request.headers['x-amz-security-token'],
          });
          if (mode === 'redirect') {
            response.writeHead(302, {
              location:
                'https://untrusted.invalid/private?X-Amz-Signature=never-log-this',
            });
            response.end('<Error><Code>Redirect</Code></Error>');
          } else if (['400', '403', '404', '503'].includes(mode)) {
            response.writeHead(Number(mode), {
              'content-type': 'application/xml',
            });
            response.end(
              '<Error><Code>InvalidRequest</Code><Message>Please use AWS4-HMAC-SHA256</Message></Error>',
            );
          } else {
            response.end(
              JSON.stringify({
                version: 1,
                kind: 'clip',
                sourceKey: 'source-videos/existing/video.mp4',
                outputKey: `${prefix}/output.mp4`,
                deadline: 0,
              }),
            );
          }
        })();
      },
    );
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    endpoint = `https://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => {
    clients.forEach((client) => client.destroy());
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    jest.restoreAllMocks();
  });
  function storage(accessKeyId = access) {
    const config = new ConfigService({
      R2_ENDPOINT: endpoint,
      R2_BUCKET_NAME: 'output',
      R2_SOURCE_BUCKET_NAME: 'private',
      R2_PUBLIC_DOMAIN: '',
      R2_ACCESS_KEY_ID: accessKeyId,
      R2_SECRET_ACCESS_KEY: secret,
    });
    const r2 = new R2Service(config);
    const client = Reflect.get(r2, 'client') as S3Client;
    // Trust only the loopback fixture certificate; use the actual Node handler.
    (client.config.requestHandler as R2HttpHandler).updateHttpClientConfig(
      'httpsAgent',
      new Agent({ ca: cert, keepAlive: true }),
    );
    client.config.maxAttempts = () => Promise.resolve(1);
    clients.push(client);
    return { r2, client, config };
  }
  it.each([
    `${prefix}/progress.json`,
    `${prefix}/output.mp4`,
    'clips/parent/clip-captioned.mp4',
  ])(
    'logs only an explicitly pending render HEAD miss at debug level: %s',
    async (objectKey) => {
      mode = '404';
      const debug = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const { r2 } = storage();
      expect(
        await r2.fileExists(objectKey, { pendingRenderArtifact: true }),
      ).toBe(false);
      expect(errorLog).not.toHaveBeenCalled();
      const events = debug.mock.calls.map(
        ([value]) => JSON.parse(String(value)) as Record<string, unknown>,
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'r2_render_artifact_pending',
          operation: 'HeadObjectCommand',
          httpStatusCode: 404,
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'r2_http_response',
          method: 'HEAD',
          httpStatusCode: 404,
        }),
      );
      expect(received[0].validSignature).toBe(true);
    },
  );
  it.each(['source', 'manifest', 'completed_output', 'untagged_output'])(
    'preserves error logging for a required or unclassified %s 404',
    async (purpose) => {
      mode = '404';
      const { r2 } = storage();
      if (purpose === 'manifest')
        await expect(r2.downloadToBuffer(key)).rejects.toThrow();
      else if (purpose === 'completed_output')
        await expect(r2.objectInfo(`${prefix}/output.mp4`)).rejects.toThrow();
      else if (purpose === 'source') {
        // Even an incorrect pending flag cannot downgrade a source check.
        expect(
          await r2.fileExists('job-sources/parent/source.mp4', {
            pendingRenderArtifact: true,
          }),
        ).toBe(false);
      } else
        expect(await r2.fileExists('clips/parent/clip-captioned.mp4')).toBe(
          false,
        );
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('r2_operation_failed'),
      );
    },
  );
  it.each(['403', '503'] as const)(
    'preserves %s errors for explicitly pending probes',
    async (status) => {
      mode = status;
      const { r2 } = storage();
      await expect(
        r2.fileExists(`${prefix}/progress.json`, {
          pendingRenderArtifact: true,
        }),
      ).rejects.toThrow();
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('r2_operation_failed'),
      );
    },
  );
  it('isolates concurrent pending and required checks and restores the default afterwards', async () => {
    mode = '404';
    const debug = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const { r2 } = storage();
    const results = await Promise.allSettled([
      r2.fileExists(`${prefix}/progress.json`, { pendingRenderArtifact: true }),
      r2.objectInfo(`${prefix}/output.mp4`),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalled();
    await expect(
      r2.objectInfo('job-sources/parent/source.mp4'),
    ).rejects.toThrow();
    expect(errorLog).toHaveBeenCalledTimes(2);
  });
  it('receives valid SigV4 over real HTTPS for the backend PUT and renderer manifest GET at the same target', async () => {
    const backend = storage(),
      renderer = storage();
    await backend.r2.uploadBuffer(Buffer.from('{}'), key, 'application/json');
    // Deliberately expired manifest stops execution after the real successful GET, before FFmpeg.
    await expect(
      runRenderer(
        key,
        '18539cf4-51fc-4d3f-8df4-b4aa9f3cdd21',
        renderer.config,
        renderer.r2,
      ),
    ).rejects.toThrow('Invalid or expired task');
    expect(
      received.map(({ method, path, validSignature, sessionToken }) => ({
        method,
        path,
        validSignature,
        sessionToken,
      })),
    ).toEqual([
      {
        method: 'PUT',
        path: `/private/${key}`,
        validSignature: true,
        sessionToken: false,
      },
      {
        method: 'GET',
        path: `/private/${key}`,
        validSignature: true,
        sessionToken: false,
      },
    ]);
    const events = logs.filter((event) => event.event === 'r2_http_response');
    expect(events).toHaveLength(2);
    expect(events[0].requestTargetId).toBe(events[1].requestTargetId);
    expect(events[1]).toMatchObject({
      authorizationScheme: 'AWS4-HMAC-SHA256',
      authorizationWellFormed: true,
      credentialMatchesConfigured: true,
      signingRegion: 'auto',
      signingService: 's3',
      signedAuthorizationUnchanged: true,
      signedTargetUnchanged: true,
      signedHeadersUnchanged: true,
      endpointMatches: true,
      hostHeaderMatches: true,
      bucketMatchesConfigured: true,
      httpStatusCode: 200,
      redirect: false,
    });
  });
  it('exposes the exact 400 response without claiming a signed request succeeded', async () => {
    mode = '400';
    await expect(storage().r2.downloadToBuffer(key)).rejects.toMatchObject({
      name: 'InvalidRequest',
      $metadata: { httpStatusCode: 400 },
    });
    expect(received[0].validSignature).toBe(true);
    expect(
      logs.find((event) => event.event === 'r2_http_response'),
    ).toMatchObject({
      httpStatusCode: 400,
      authorizationWellFormed: true,
      redirect: false,
    });
  });
  it('observes redirects without following them or exposing their Location', async () => {
    mode = 'redirect';
    await expect(storage().r2.downloadToBuffer(key)).rejects.toBeDefined();
    expect(received).toHaveLength(1);
    expect(
      logs.find((event) => event.event === 'r2_http_response'),
    ).toMatchObject({
      httpStatusCode: 302,
      redirect: true,
      locationPresent: true,
      transportFollowsRedirects: false,
    });
    expect(JSON.stringify(logs)).not.toMatch(
      /untrusted|never-log-this|X-Amz-Signature/,
    );
  });
  it.each([
    'key with spaces',
    '{"access":"id","secret":"value"}',
    'quoted"key',
    'key/with/scope',
  ])(
    'blocks malformed signing input despite the old true prefix observation: %s',
    async (badAccess) => {
      await expect(
        storage(badAccess).r2.downloadToBuffer(key),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(received).toHaveLength(0);
      expect(
        logs.find((event) => event.event === 'r2_http_request_blocked'),
      ).toMatchObject({
        authorizationScheme: 'AWS4-HMAC-SHA256',
        authorizationWellFormed: false,
      });
      expect(JSON.stringify(logs)).not.toContain(badAccess);
    },
  );
  it('detects middleware changing a signed header after the existing signing diagnostic', async () => {
    const { r2, client } = storage();
    const mutate: FinalizeRequestMiddleware<
      ServiceInputTypes,
      ServiceOutputTypes
    > = (next) => (args) => {
      (args.request as { headers: Record<string, string> }).headers[
        'x-amz-date'
      ] = '20000101T000000Z';
      return next(args);
    };
    client.middlewareStack.addRelativeTo(mutate, {
      name: 'syntheticPostSigningMutation',
      relation: 'after',
      toMiddleware: 'r2SigningDiagnostics',
    });
    await expect(r2.downloadToBuffer(key)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(received).toHaveLength(0);
    expect(
      logs.find((event) => event.event === 'r2_http_request_blocked'),
    ).toMatchObject({
      authorizationWellFormed: true,
      signedHeadersUnchanged: false,
    });
  });
  it('preserves encoded object paths and valid canonical signatures', async () => {
    await storage().r2.downloadToBuffer('source-videos/a b/clip+é.mp4');
    expect(received[0]).toMatchObject({
      path: '/private/source-videos/a%20b/clip%2B%C3%A9.mp4',
      validSignature: true,
    });
  });
  it('retains valid streamed uploads and source HEAD requests through the same guard', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'r2-wire-upload-'));
    try {
      const { r2 } = storage();
      const file = join(directory, 'fixture.mp4');
      await writeFile(file, 'synthetic-video-bytes');
      await r2.uploadFile(file, `${prefix}/output.mp4`);
      await r2.objectInfo('source-videos/existing/video.mp4');
      expect(
        received.map(({ method, validSignature }) => ({
          method,
          validSignature,
        })),
      ).toEqual([
        { method: 'PUT', validSignature: true },
        { method: 'HEAD', validSignature: true },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('allows equivalent header casing and canonical query reordering', async () => {
    const { r2, client } = storage();
    const reorder: FinalizeRequestMiddleware<
      ServiceInputTypes,
      ServiceOutputTypes
    > = (next) => (args) => {
      const request = args.request as {
        headers: Record<string, string>;
        query: Record<string, string>;
      };
      request.headers.Authorization = request.headers.authorization;
      delete request.headers.authorization;
      request.query = Object.fromEntries(
        Object.entries(request.query).reverse(),
      );
      return next(args);
    };
    client.middlewareStack.addRelativeTo(reorder, {
      name: 'equivalentOrdering',
      relation: 'after',
      toMiddleware: 'r2SigningDiagnostics',
    });
    await r2.downloadToBuffer(key);
    expect(received[0].validSignature).toBe(true);
    expect(
      logs.find((event) => event.event === 'r2_http_response'),
    ).toMatchObject({
      signedAuthorizationUnchanged: true,
      signedTargetUnchanged: true,
      signedHeadersUnchanged: true,
    });
  });
  afterEach(() => {
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(access);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('Credential=');
    expect(serialized).not.toContain(prefix);
  });
});

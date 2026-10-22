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
  let mode: 'ok' | '400' | 'redirect';
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
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
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
          } else if (mode === '400') {
            response.writeHead(400, { 'content-type': 'application/xml' });
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

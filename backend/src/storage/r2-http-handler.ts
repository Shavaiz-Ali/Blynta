import { createHash } from 'node:crypto';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { UnrecoverableError } from 'bullmq';
import { r2FailureDetails } from './r2-diagnostics';

type Request = Parameters<NodeHttpHandler['handle']>[0];
type Options = Parameters<NodeHttpHandler['handle']>[1];
interface Settings {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: string[];
}
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const header = (request: Request, name: string) =>
  Object.entries(request.headers).filter(([key]) => key.toLowerCase() === name);
// Parse, never log, credential IDs, signatures or complete authorization values.
const authorization = (request: Request) => {
  const entries = header(request, 'authorization');
  const value = entries.length === 1 ? entries[0][1] : '';
  const match =
    /^AWS4-HMAC-SHA256 Credential=([A-Za-z0-9_-]+)\/(\d{8})\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/aws4_request, SignedHeaders=([a-z0-9-]+(?:;[a-z0-9-]+)*), Signature=([a-f0-9]{64})$/.exec(
      value,
    );
  return { entries, value, match };
};
const snapshot = (request: Request) => {
  const auth = authorization(request);
  return {
    authorization: hash(auth.entries.map(([, value]) => value)),
    target: hash([
      request.protocol,
      request.hostname,
      request.port,
      request.method,
      request.path,
      Object.entries(request.query ?? {})
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, value]) => [
          name,
          Array.isArray(value) ? [...value].sort() : value,
        ]),
    ]),
    signedHeaders: hash(
      (auth.match?.[5].split(';') ?? []).map((name) => [
        name,
        header(request, name).map(([, value]) => value),
      ]),
    ),
  };
};

export function r2TargetId(
  request: Pick<Request, 'protocol' | 'hostname' | 'port' | 'path'>,
) {
  return hash([
    request.protocol,
    request.hostname.toLowerCase(),
    request.port ?? (request.protocol === 'https:' ? 443 : 80),
    request.path,
  ]);
}

/** Observe immediately before the real Node transport, after all SDK middleware. */
export class R2HttpHandler extends NodeHttpHandler {
  private readonly signed = new WeakMap<object, ReturnType<typeof snapshot>>();
  constructor(
    private readonly settings: Settings,
    private readonly report: (event: Record<string, unknown>) => void,
  ) {
    // Preserve the existing transport, TLS verification, agents and timeout settings.
    super({ connectionTimeout: 10000, socketTimeout: 120000 });
  }
  observeSignedRequest(request: Request) {
    this.signed.set(request, snapshot(request));
  }
  async handle(request: Request, options?: Options) {
    const { match, value, entries } = authorization(request);
    const signed = this.signed.get(request),
      final = snapshot(request);
    let endpoint: URL | undefined;
    try {
      endpoint = new URL(this.settings.endpoint);
    } catch {
      /* No untrusted URL in logs. */
    }
    const segments = request.path.split('/');
    const bucketMatchesConfigured = this.settings.buckets.includes(segments[1]);
    const manifest =
      segments.length === 6 &&
      segments[2] === 'job-sources' &&
      segments[3] === 'batch' &&
      /^[a-f0-9]{64}$/.test(segments[4]) &&
      segments[5] === 'task.json';
    const safeHostname =
      /^[a-z0-9.-]+$/i.test(request.hostname) &&
      ![this.settings.accessKeyId, this.settings.secretAccessKey].some((key) =>
        request.hostname.includes(key),
      )
        ? request.hostname
        : '[REDACTED]';
    const details = {
      diagnosticsVersion: 1,
      boundary: 'NodeHttpHandler.handle',
      ...(process.env.AWS_BATCH_JOB_ID &&
      /^[a-f0-9-]{36}$/i.test(process.env.AWS_BATCH_JOB_ID)
        ? { jobId: process.env.AWS_BATCH_JOB_ID }
        : {}),
      method: ['GET', 'HEAD', 'PUT', 'DELETE'].includes(request.method)
        ? request.method
        : 'other',
      hostname: safeHostname,
      endpointMatches:
        !!endpoint &&
        endpoint.hostname === request.hostname &&
        endpoint.protocol === request.protocol &&
        Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)) ===
          (request.port ?? (request.protocol === 'https:' ? 443 : 80)),
      hostHeaderMatches:
        header(request, 'host')[0]?.[1] ===
        `${request.hostname}${request.port && ![443, 80].includes(request.port) ? `:${request.port}` : ''}`,
      requestPathShape: manifest
        ? '/[bucket]/job-sources/batch/[execution]/task.json'
        : '/[bucket]/[object]',
      requestTargetId: r2TargetId(request),
      bucketMatchesConfigured,
      authorizationScheme: value.startsWith('AWS4-HMAC-SHA256 ')
        ? 'AWS4-HMAC-SHA256'
        : !entries.length
          ? 'absent'
          : 'other',
      authorizationWellFormed: !!match,
      credentialMatchesConfigured:
        !!match && match[1] === this.settings.accessKeyId,
      credentialSource: 'explicit_R2_configuration',
      accessKeyHasR2Format: /^[a-f0-9]{32}$/i.test(this.settings.accessKeyId),
      secretKeyHasR2Format: /^[a-f0-9]{64}$/i.test(
        this.settings.secretAccessKey,
      ),
      signingRegion: match
        ? match[3] === 'auto'
          ? 'auto'
          : 'other'
        : undefined,
      signingService: match ? (match[4] === 's3' ? 's3' : 'other') : undefined,
      sessionTokenPresent: header(request, 'x-amz-security-token').length > 0,
      querySignaturePresent: Object.keys(request.query ?? {}).some((key) =>
        /^(x-amz-signature|signature|awsaccesskeyid)$/i.test(key),
      ),
      signedAuthorizationUnchanged: signed
        ? signed.authorization === final.authorization
        : undefined,
      signedTargetUnchanged: signed
        ? signed.target === final.target
        : undefined,
      signedHeadersUnchanged: signed
        ? signed.signedHeaders === final.signedHeaders
        : undefined,
      proxyEnvironmentPresent: [
        'HTTP_PROXY',
        'HTTPS_PROXY',
        'ALL_PROXY',
        'http_proxy',
        'https_proxy',
        'all_proxy',
      ].some((key) => !!process.env[key]),
      nodeUseEnvProxy: process.env.NODE_USE_ENV_PROXY === '1',
      nodePreloadConfigured:
        /--require|--import|--experimental-loader|(?:^|\s)-r(?:\s|$)/.test(
          process.env.NODE_OPTIONS ?? '',
        ),
      nodeVersion: process.version,
    };
    if (
      !match ||
      match[1] !== this.settings.accessKeyId ||
      (signed &&
        (signed.authorization !== final.authorization ||
          signed.target !== final.target ||
          signed.signedHeaders !== final.signedHeaders))
    ) {
      this.report({ event: 'r2_http_request_blocked', ...details });
      throw new UnrecoverableError(
        'R2 authorization is malformed or the signed request changed; inspect safe transport diagnostics.',
      );
    }
    if (manifest) this.report({ event: 'r2_http_request', ...details });
    try {
      const result = await super.handle(request, options);
      const response = result.response;
      const redirect = response.statusCode >= 300 && response.statusCode < 400;
      const location = Object.entries(response.headers).find(
        ([name]) => name.toLowerCase() === 'location',
      )?.[1];
      const ray = Object.entries(response.headers).find(
        ([name]) => name.toLowerCase() === 'cf-ray',
      )?.[1];
      if (manifest || response.statusCode >= 300)
        this.report({
          event: 'r2_http_response',
          ...details,
          httpStatusCode: response.statusCode,
          redirect,
          locationPresent: !!location,
          cloudflareRayId:
            ray &&
            /^[a-f0-9]{16,32}-[a-z]{3}$/i.test(ray) &&
            ![this.settings.accessKeyId, this.settings.secretAccessKey].some(
              (value) => ray.includes(value),
            )
              ? ray
              : undefined,
          transportFollowsRedirects: false,
        });
      return result;
    } catch (error) {
      this.report({
        event: 'r2_http_transport_failed',
        ...details,
        ...r2FailureDetails(error, [
          this.settings.accessKeyId,
          this.settings.secretAccessKey,
        ]),
      });
      throw error;
    }
  }
}

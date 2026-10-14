import { Logger } from '@nestjs/common';
import { GoogleAdapter } from './google-adapter.service';
import {
  googleResponseFailure,
  sanitizeProviderMessage,
  credentialWasRejected,
} from './provider-errors';
import type { AIProvider } from './registry.schemas';

const secret = 'synthetic-private-secret';
const provider = {
  adapter: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiVersion: 'v1beta',
} as AIProvider;
function failure(
  http: number,
  status: string,
  reason?: string,
  message = 'Provider rejected the request.',
) {
  return new Response(
    JSON.stringify({
      error: {
        code: http,
        status,
        message,
        details: reason
          ? [
              {
                '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason,
                metadata: { apiKey: secret, consumer: 'private-project' },
              },
            ]
          : [],
      },
    }),
    { status: http, headers: { 'x-private-header': secret } },
  );
}
describe('Google credential request and safe diagnostics', () => {
  let warnings: jest.SpyInstance;
  beforeEach(() => {
    warnings = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['v1', 'v1beta'])(
    'uses the configured %s model-list endpoint, GET, key header, and pageSize=1',
    async (apiVersion) => {
      const fetch = jest
        .fn<Promise<Response>, [AIProvider, Request]>()
        .mockResolvedValue(new Response('{"models":[]}', { status: 200 }));
      const adapter = new GoogleAdapter({ fetch });
      const signal = AbortSignal.timeout(1000);
      await expect(
        adapter.validateCredential({ ...provider, apiVersion }, secret, signal),
      ).resolves.toEqual({ valid: true });
      const request = fetch.mock.calls[0][1];
      expect(request.url).toBe(
        `https://generativelanguage.googleapis.com/${apiVersion}/models?pageSize=1`,
      );
      expect(request.method).toBe('GET');
      expect(request.headers.get('x-goog-api-key')).toBe(secret);
      expect(request.headers.get('authorization')).toBeNull();
      expect(request.body).toBeNull();
      expect(warnings).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      400,
      'INVALID_ARGUMENT',
      'API_KEY_INVALID',
      'AI_AUTH_OR_ACCESS_FAILED',
      true,
    ],
    [400, 'INVALID_ARGUMENT', undefined, 'AI_REQUEST_FAILED', false],
    [400, 'FAILED_PRECONDITION', undefined, 'AI_REQUEST_FAILED', false],
    [
      429,
      'RESOURCE_EXHAUSTED',
      'RESOURCE_QUOTA_EXCEEDED',
      'AI_QUOTA_OR_RATE_LIMIT',
      false,
    ],
    [400, 'RESOURCE_EXHAUSTED', undefined, 'AI_QUOTA_OR_RATE_LIMIT', false],
    [
      403,
      'PERMISSION_DENIED',
      'API_KEY_IP_ADDRESS_BLOCKED',
      'AI_AUTH_OR_ACCESS_FAILED',
      false,
    ],
    [
      400,
      'INVALID_ARGUMENT',
      'SERVICE_DISABLED',
      'AI_AUTH_OR_ACCESS_FAILED',
      false,
    ],
    [401, 'UNAUTHENTICATED', undefined, 'AI_AUTH_OR_ACCESS_FAILED', true],
    [504, 'DEADLINE_EXCEEDED', undefined, 'AI_TIMEOUT', false],
  ] as const)(
    'maps HTTP %s / %s / %s by Google details',
    async (http, status, reason, code, invalid) => {
      const fetch = jest
        .fn()
        .mockResolvedValue(
          failure(http, status, reason, `Explanation includes ${secret}.`),
        );
      const result = await new GoogleAdapter({ fetch }).validateCredential(
        provider,
        secret,
        AbortSignal.timeout(1000),
      );
      expect(result).toMatchObject({
        valid: false,
        code,
        upstreamStatus: http,
        upstreamCode: http,
        upstreamErrorStatus: status,
      });
      if (reason) expect(result).toMatchObject({ upstreamReason: reason });
      expect(credentialWasRejected(result)).toBe(invalid);
      const output = JSON.stringify({ result, warnings: warnings.mock.calls });
      expect(output).toContain('[REDACTED]');
      for (const sensitive of [
        secret,
        'private-project',
        'x-private-header',
        'apiKey',
        'metadata',
      ])
        expect(output).not.toContain(sensitive);
      expect(warnings).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['TimeoutError', 'AbortError'])(
    'handles %s without exposing exception messages',
    async (name) => {
      const error = new Error(secret);
      error.name = name;
      const result = await new GoogleAdapter({
        fetch: jest.fn().mockRejectedValue(error),
      }).validateCredential(provider, secret, AbortSignal.timeout(1000));
      expect(result).toMatchObject({ valid: false, code: 'AI_TIMEOUT' });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(credentialWasRejected(result)).toBe(false);
    },
  );

  it.each([
    'not JSON ' + secret,
    JSON.stringify({ error: { message: secret.repeat(4000) } }),
  ])('does not return malformed or oversized raw bodies', async (body) => {
    const result = await googleResponseFailure(
      new Response(body, { status: 400 }),
      secret,
      true,
    );
    expect(result.code).toBe('AI_REQUEST_FAILED');
    expect(result.upstreamMessage).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('redacts literal/encoded credentials, other Google keys, URLs, account identifiers and log control characters', () => {
    const value = sanitizeProviderMessage(
      `${secret} ${encodeURIComponent(secret)} ${Buffer.from(secret).toString('base64')} AIzaExampleOtherSecretKey0123456789 https://example.test/?key=private admin@example.test 13.234.63.132 projects/private-account\nmessage`,
      secret,
    )!;
    for (const sensitive of [
      secret,
      'AIza',
      'https://',
      'admin@example.test',
      '13.234.63.132',
      'private-account',
      '\n',
    ])
      expect(value).not.toContain(sensitive);
    expect(value).toContain('message');
  });
});

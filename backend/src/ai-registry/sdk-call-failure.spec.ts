import { sdkCallFailure } from './call-diagnostics';

describe('Bounded SDK failure normalization', () => {
  it.each([
    [403, 'PERMISSION_DENIED', 'AI_AUTH_FAILED'],
    [429, 'RESOURCE_EXHAUSTED', 'AI_QUOTA_OR_RATE_LIMIT'],
    [503, 'UNAVAILABLE', 'AI_PROVIDER_FAILED'],
  ])(
    'preserves HTTP %s through nested SDK errors safely',
    async (status, errorStatus, code) => {
      const provider = {
        statusCode: status,
        responseBody: JSON.stringify({
          error: {
            status: errorStatus,
            message: 'private synthetic prompt and key',
          },
        }),
      };
      const result = await sdkCallFailure(
        { name: 'AI_NoObjectGeneratedError', cause: provider },
        'key',
      );
      expect(result).toMatchObject({
        code,
        upstreamStatus: status,
        origin: 'provider_http',
      });
      expect(JSON.stringify(result)).not.toContain('private synthetic');
    },
  );
  it('handles circular retry/cause graphs without replacing the original error with recursion', async () => {
    const error: Record<string, unknown> = { name: 'AI_RetryError' };
    error.cause = error;
    error.lastError = error;
    error.errors = [error];
    expect(await sdkCallFailure(error, '')).toMatchObject({
      code: 'AI_ADAPTER_FAILED',
    });
    expect(error.cause).toBe(error);
  });
  it('distinguishes invalid structured responses, token limits and network timeout', async () => {
    expect(
      await sdkCallFailure({ name: 'AI_NoObjectGeneratedError' }, ''),
    ).toMatchObject({
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      origin: 'provider_response',
    });
    expect(
      await sdkCallFailure(
        { name: 'AI_NoObjectGeneratedError', finishReason: 'length' },
        '',
      ),
    ).toMatchObject({ code: 'AI_OUTPUT_TOKEN_LIMIT' });
    expect(
      await sdkCallFailure({ cause: { code: 'ETIMEDOUT' } }, ''),
    ).toMatchObject({ code: 'AI_TIMEOUT', origin: 'transport' });
  });
});

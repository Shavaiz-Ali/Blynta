import { randomBytes } from 'node:crypto';
import { validateEnvironment } from './configuration';
const basic = {
  MONGO_URI: 'mongodb://localhost/test',
  JWT_SECRET: 'synthetic-secret',
};
describe('Startup configuration policy', () => {
  it('coerces operational numbers while preserving string flags', () => {
    expect(
      validateEnvironment(
        { ...basic, PIPELINE_CONCURRENCY: '2', BILLING_CREDITS_V2: 'false' },
        true,
      ),
    ).toMatchObject({
      PIPELINE_CONCURRENCY: 2,
      BILLING_CREDITS_V2: 'false',
      AI_CREDENTIAL_TIMEOUT_MS: 15000,
    });
  });
  it.each([
    { REDIS_PORT: '0' },
    { PIPELINE_CONCURRENCY: '9' },
    { FFMPEG_THREADS: 'NaN' },
    { AI_CREDENTIAL_TIMEOUT_MS: '60001' },
    { BILLING_CREDITS_V2: 'yes' },
    { MEDIA_WORKER_ROLE: 'invalid' },
    { R2_ENDPOINT: 'file:///secret' },
    { AI_CREDENTIAL_KEYS: '{"v1":"secret-value"}' },
  ])('rejects invalid configuration without echoing secrets: %p', (values) => {
    expect(() => validateEnvironment({ ...basic, ...values })).toThrow(
      /Invalid or missing configuration/,
    );
    try {
      validateEnvironment({ ...basic, ...values });
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });
  it('accepts versioned vault keys and rejects a missing active version', () => {
    const keys = JSON.stringify({ v1: randomBytes(32).toString('base64') });
    expect(
      validateEnvironment({ ...basic, AI_CREDENTIAL_KEYS: keys }),
    ).toHaveProperty('AI_CREDENTIAL_KEYS', keys);
    expect(() =>
      validateEnvironment({
        ...basic,
        AI_CREDENTIAL_KEYS: keys,
        AI_CREDENTIAL_KEY_VERSION: 'v2',
      }),
    ).toThrow();
  });
  it('requires API auth configuration without requiring it for independent workers', () => {
    expect(() =>
      validateEnvironment({ MONGO_URI: basic.MONGO_URI }, true),
    ).toThrow(/JWT_SECRET/);
    expect(validateEnvironment({ MONGO_URI: basic.MONGO_URI })).toHaveProperty(
      'MONGO_URI',
    );
  });
});

import { AI_LIMITS } from '../ai-registry/provider-policy';
/** Startup policy shared by API and worker entry points; errors never echo values. */
export function validateEnvironment(
  input: Record<string, unknown>,
  api = false,
) {
  const env = { ...input };
  const fail = (key: string): never => {
    throw new Error(`Invalid or missing configuration: ${key}`);
  };
  const text = (key: string, fallback?: string): string => {
    const value = env[key] ?? fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return value.toString();
    return fail(key);
  };
  const required = ['MONGO_URI', ...(api ? ['JWT_SECRET'] : [])];
  for (const key of required)
    if (typeof env[key] !== 'string' || !env[key].trim()) fail(key);
  if (!/^mongodb(?:\+srv)?:\/\//.test(text('MONGO_URI'))) fail('MONGO_URI');
  const numeric: Record<string, readonly [number, number, number?]> = {
    PORT: [1, 65535, 5001],
    REDIS_PORT: [1, 65535, 6379],
    MAIL_PORT: [1, 65535],
    AI_CREDENTIAL_TIMEOUT_MS: [1000, 60000, AI_LIMITS.CREDENTIAL_TIMEOUT_MS],
    AI_AGENT_DAILY_REQUEST_LIMIT: [1, 100000, 50],
    PIPELINE_CONCURRENCY: [1, 8],
    RENDER_CONCURRENCY: [1, 8],
    RENDER_GLOBAL_CONCURRENCY: [1, 8],
    STUDIO_CONCURRENCY: [1, 8],
    EDIT_RENDER_CONCURRENCY: [1, 8],
    MEDIA_HOST_CONCURRENCY: [1, 8],
    FFMPEG_THREADS: [1, 8],
    MEDIA_COMMAND_TIMEOUT_SECONDS: [1, 86400],
    EDIT_RENDER_TIMEOUT_SECONDS: [1, 86400],
    EDIT_SOURCE_MAX_BYTES: [1, 10 * 1024 ** 3],
    EDIT_OUTPUT_MAX_BYTES: [1, 10 * 1024 ** 3],
  };
  for (const [key, [min, max, fallback]] of Object.entries(numeric)) {
    if (env[key] === undefined || env[key] === '') {
      if (fallback !== undefined) env[key] = fallback;
      continue;
    }
    const value = Number(env[key]);
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(key);
    env[key] = value;
  }
  for (const key of ['RECONCILE_IN_WORKER', 'BILLING_CREDITS_V2'])
    if (env[key] !== undefined && !['true', 'false'].includes(text(key)))
      fail(key);
  for (const [key, allowed] of Object.entries({
    MEDIA_WORKER_ROLE: ['all', 'pipeline', 'render', 'studio', 'editing'],
    PADDLE_ENV: ['sandbox', 'production'],
    LLM_PROVIDER: ['google', 'groq'],
  })) {
    if (
      env[key] !== undefined &&
      env[key] !== '' &&
      !allowed.includes(text(key))
    )
      fail(key);
  }
  for (const key of [
    'FRONTEND_URL',
    'R2_ENDPOINT',
    'R2_PUBLIC_DOMAIN',
    'GOOGLE_REDIRECT_URI',
    'LLM_BASE_URL',
  ]) {
    if (!env[key]) continue;
    try {
      const url = new URL(text(key));
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        fail(key);
    } catch {
      fail(key);
    }
  }
  if (env.AI_CREDENTIAL_KEYS && env.AI_CREDENTIAL_KEYS !== '{}') {
    try {
      const keys: unknown = JSON.parse(text('AI_CREDENTIAL_KEYS'));
      if (!keys || typeof keys !== 'object' || Array.isArray(keys))
        fail('AI_CREDENTIAL_KEYS');
      for (const [version, key] of Object.entries(keys as object))
        if (
          !/^[a-zA-Z0-9_-]{1,30}$/.test(version) ||
          typeof key !== 'string' ||
          !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
          Buffer.from(key, 'base64').length !== 32
        )
          fail('AI_CREDENTIAL_KEYS');
      if (!(text('AI_CREDENTIAL_KEY_VERSION', 'v1') in (keys as object)))
        fail('AI_CREDENTIAL_KEY_VERSION');
    } catch {
      fail('AI_CREDENTIAL_KEYS');
    }
  }
  for (const key of ['BILLING_PRICING_JSON', 'BILLING_COST_RATES_JSON'])
    if (env[key]) {
      try {
        const value: unknown = JSON.parse(text(key));
        if (!value || typeof value !== 'object' || Array.isArray(value))
          fail(key);
      } catch {
        fail(key);
      }
    }
  return env;
}

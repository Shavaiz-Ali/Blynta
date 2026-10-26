import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { CredentialVault } from './credential-vault.service';
import { ModelRegistry } from './model-registry.service';
import { ProviderValidationService } from './provider-validation.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { modelInput } from './registry.contract';
import { testGoogleAdapter } from '../../test/google-sdk.fixture';
import {
  AIProvider,
  AICredential,
  AIModel,
  AIRouting,
  AIUsage,
} from './registry.schemas';
import { User } from '../users/schemas/user.schema';

const providerId = '111111111111111111111111';
const credentialId = '222222222222222222222222';
const modelId = '333333333333333333333333';
const otherId = '444444444444444444444444';

// Evaluate the predicates produced by the real services, including Mongo null
// matching missing fields. These repositories do not choose a result for them.
type Row = Record<string, unknown>;
function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return (expected as Row[]).some((f) => matches(row, f));
    const actual = key
      .split('.')
      .reduce<unknown>((v, part) => (v as Row | undefined)?.[part], row);
    if (expected && typeof expected === 'object' && '$ne' in expected)
      return actual !== (expected as Row).$ne;
    if (expected === null) return actual == null;
    return actual === expected;
  });
}
function repository(rows: Row[]) {
  return {
    findOne: (filter: Row) => {
      const result = Promise.resolve(
        rows.find((r) => matches(r, filter)) ?? null,
      );
      return Object.assign(result, {
        select: () => result,
        sort: () => result,
      });
    },
    exists: (filter: Row) =>
      Promise.resolve(rows.some((r) => matches(r, filter))),
    updateOne: jest.fn(() => Promise.resolve({ matchedCount: 1 })),
  };
}
function setup() {
  const vault = new CredentialVault(
    new ConfigService({
      AI_CREDENTIAL_KEYS: JSON.stringify({
        v1: randomBytes(32).toString('base64'),
      }),
    }),
  );
  const provider = {
    _id: providerId,
    code: 'legacy-model-looking-code',
    adapter: 'google',
    enabled: true,
    revision: 1,
    defaultCredentialId: null as string | null,
  };
  const credential = {
    _id: credentialId,
    providerId,
    enabled: true,
    archived: false,
    revision: 1,
    ...vault.encrypt(
      'synthetic-private-secret',
      `${providerId}:${credentialId}`,
    ),
  };
  const model = {
    _id: modelId,
    ...modelInput.parse({
      providerId,
      credentialId: null,
      modelId: 'gemini-flash-latest',
      displayName: 'Test',
      enabled: true,
      capabilities: {
        text: true,
        structuredOutput: true,
        vision: false,
        audioInput: false,
        toolCalling: false,
      },
      settings: {},
      access: { allowedPlans: ['free', 'pro'], selectable: true },
    }),
    archived: false,
  };
  const models: Row[] = [model];
  const credentials: Row[] = [credential];
  const route = { modelId: null as string | null };
  const fetch = jest.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
        { status: 200 },
      ),
    ),
  );
  const adapters = new ProviderAdapterRegistry(testGoogleAdapter({ fetch }));
  const registry = new ModelRegistry(
    repository([provider]) as unknown as Model<AIProvider>,
    repository(credentials) as unknown as Model<AICredential>,
    repository(models) as unknown as Model<AIModel>,
    {
      findById: () => Promise.resolve(route.modelId ? route : null),
    } as unknown as Model<AIRouting>,
    {} as Model<AIUsage>,
    {} as Model<User>,
    vault,
    adapters,
  );
  const validation = new ProviderValidationService(
    registry,
    vault,
    adapters,
    new ConfigService(),
  );
  return {
    registry,
    validation,
    provider,
    credential,
    model,
    models,
    credentials,
    route,
    fetch,
    vault,
  };
}

describe('Credential probes and runtime inheritance', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
  );
  afterEach(() => jest.restoreAllMocks());
  it.each([null, credentialId, otherId])(
    'probes an inherited singleton with provider default %s without changing bindings',
    async (defaultId) => {
      const s = setup();
      s.provider.defaultCredentialId = defaultId;
      await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
        valid: true,
        modelId: 'gemini-flash-latest',
      });
      expect(s.fetch).toHaveBeenCalledTimes(1);
      expect(s.provider.defaultCredentialId).toBe(defaultId);
      expect(s.model.credentialId).toBeNull();
    },
  );
  it('allows a direct binding with no provider default', async () => {
    const s = setup();
    s.model.credentialId = credentialId;
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: true,
    });
    await expect(s.registry.configured(modelId, false)).resolves.toHaveProperty(
      'credential._id',
      credentialId,
    );
  });
  it('runtime requires an explicit inherited credential even after successful probing', async () => {
    const s = setup();
    await s.validation.validate(credentialId);
    await expect(s.registry.configured(modelId, false)).rejects.toThrow(
      'AI credential is unavailable',
    );
    s.provider.defaultCredentialId = credentialId;
    await expect(s.registry.configured(modelId, false)).resolves.toHaveProperty(
      'credential._id',
      credentialId,
    );
  });
  it('does not pick by priority when multiple models qualify; accepts an explicit model or eligible Auto default', async () => {
    const s = setup();
    s.models.push({
      ...s.model,
      _id: otherId,
      modelId: 'gemini-other',
      priority: -1,
    });
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: false,
      category: 'configuration_error',
      credentialStatus: 'undetermined',
    });
    expect(s.fetch).not.toHaveBeenCalled();
    await expect(
      s.validation.validate(credentialId, otherId),
    ).resolves.toMatchObject({ valid: true, modelId: 'gemini-other' });
    s.route.modelId = modelId;
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: true,
      modelId: 'gemini-flash-latest',
    });
  });
  it('ignores an ineligible Auto default and resolves the sole remaining compatible model', async () => {
    const s = setup();
    s.models.push({ ...s.model, _id: otherId, credentialId: otherId });
    s.route.modelId = otherId;
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: true,
      modelId: 'gemini-flash-latest',
    });
    await expect(
      s.validation.validate(credentialId, otherId),
    ).resolves.toMatchObject({ valid: false });
  });
  it.each([
    'disabled',
    'archived',
    'no-text',
    'other-provider',
    'other-credential',
    'missing',
  ])('rejects %s models without calling the provider', async (reason) => {
    const s = setup();
    if (reason === 'disabled') s.model.enabled = false;
    if (reason === 'archived') s.model.archived = true;
    if (reason === 'no-text') s.model.capabilities.text = false;
    if (reason === 'other-provider') s.model.providerId = otherId;
    if (reason === 'other-credential') s.model.credentialId = otherId;
    if (reason === 'missing') s.models.length = 0;
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: false,
      credentialStatus: 'undetermined',
      category: 'configuration_error',
    });
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it('tests each credential under a shared provider without changing environment bindings', async () => {
    const s = setup();
    s.credentials.push({
      ...s.credential,
      _id: otherId,
      ...s.vault.encrypt('synthetic-second-secret', `${providerId}:${otherId}`),
    });
    await expect(s.validation.validate(otherId)).resolves.toMatchObject({
      valid: true,
    });
    expect(s.fetch.mock.calls.length).toBe(1);
    s.fetch.mockClear();
    // A direct binding remains exclusive even if the provider owns other keys.
    s.model.credentialId = otherId;
    await expect(s.validation.validate(credentialId)).resolves.toMatchObject({
      valid: false,
    });
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it.each(['disabled', 'archived', 'other-provider'])(
    'runtime fails closed for a %s inherited credential',
    async (reason) => {
      const s = setup();
      s.provider.defaultCredentialId = credentialId;
      if (reason === 'disabled') s.credential.enabled = false;
      if (reason === 'archived') s.credential.archived = true;
      if (reason === 'other-provider') s.credential.providerId = otherId;
      await expect(s.registry.configured(modelId, false)).rejects.toThrow(
        'AI credential is unavailable',
      );
    },
  );
  it('rejects disabled providers before any probe', async () => {
    const s = setup();
    s.provider.enabled = false;
    await expect(s.validation.validate(credentialId)).rejects.toThrow(
      'Credential/provider is unavailable',
    );
    expect(s.fetch).not.toHaveBeenCalled();
  });
});

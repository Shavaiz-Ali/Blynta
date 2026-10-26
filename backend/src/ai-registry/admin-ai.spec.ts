import { ProviderValidationService } from './provider-validation.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AdminAIService } from './admin-ai.service';
import { ModelRegistry } from './model-registry.service';
import { testGoogleAdapter } from '../../test/google-sdk.fixture';
import { CredentialVault, SealedSecret } from './credential-vault.service';
import { ActivitiesService } from '../activities/activities.service';
const id = '111111111111111111111111',
  providerId = '222222222222222222222222';
function setup() {
  const provider = { _id: providerId, adapter: 'google', enabled: true };
  const credential = {
    _id: id,
    providerId,
    label: 'Test',
    enabled: false,
    revision: 1,
  };
  const metadata = { _id: id, providerId, label: 'Test', enabled: true };
  const registry = {
    providers: {
      exists: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(provider),
      findOne: jest.fn().mockResolvedValue(provider),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(provider),
      create: jest.fn().mockResolvedValue(provider),
    },
    credentials: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockResolvedValue(credential),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(() => ({
        orFail: jest.fn().mockResolvedValue(metadata),
      })),
      updateOne: jest.fn().mockResolvedValue({}),
    },
    models: {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockImplementation(() =>
        Object.assign(
          Promise.resolve({
            modelId: 'gemini-3.5-flash-lite',
            credentialId: id,
            settings: { maxOutputTokens: 4096 },
          }),
          {
            sort: jest.fn().mockResolvedValue({
              modelId: 'gemini-3.5-flash-lite',
              credentialId: id,
              settings: { maxOutputTokens: 4096 },
            }),
          },
        ),
      ),
    },
    routing: {
      exists: jest.fn().mockResolvedValue(false),
      findById: jest.fn().mockResolvedValue(null),
    },
  };
  const activities = { create: jest.fn().mockResolvedValue({}) };
  const vault = new CredentialVault(
    new ConfigService({
      AI_CREDENTIAL_KEYS: JSON.stringify({
        v1: randomBytes(32).toString('base64'),
      }),
    }),
  );
  const transport = { fetch: jest.fn() };
  const adapters = new ProviderAdapterRegistry(testGoogleAdapter(transport));
  const validation = new ProviderValidationService(
    registry as unknown as ModelRegistry,
    vault,
    adapters,
    new ConfigService(),
  );
  const service = new AdminAIService(
    registry as unknown as ModelRegistry,
    vault,
    adapters,
    activities as unknown as ActivitiesService,
    validation,
  );
  return {
    service,
    registry,
    activities,
    vault,
    credential,
    transport,
    provider,
  };
}
describe('Administrator credential and provider boundaries', () => {
  it('encrypts before persistence and reads back only metadata', async () => {
    const s = setup();
    s.registry.credentials.findById.mockResolvedValue({
      _id: id,
      providerId,
      label: 'Test',
      enabled: false,
      revision: 1,
    });
    await s.service.addCredential(id, providerId, {
      label: 'Test',
      secret: 'synthetic-private-secret',
    });
    const calls = s.registry.credentials.create.mock.calls as unknown as [
      SealedSecret & {
        _id: { toString(): string };
        providerId: string;
        secret?: string;
      },
    ][];
    const payload = calls[0][0];
    expect(payload.secret).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('synthetic-private-secret');
    expect(
      s.vault.decrypt(payload, providerId + ':' + String(payload._id)),
    ).toBe('synthetic-private-secret');
    expect(s.registry.credentials.findById).toHaveBeenCalled();
    expect(JSON.stringify(s.activities.create.mock.calls)).not.toContain(
      'synthetic-private-secret',
    );
  });
  it('replacement is explicit, revision-fenced and does not implicitly enable disabled credentials', async () => {
    const s = setup();
    await s.service.replaceCredential(id, id, { label: 'Renamed' });
    const calls = s.registry.credentials.findOneAndUpdate.mock
      .calls as unknown as [
      unknown,
      { $set: Record<string, unknown>; $inc: { revision: number } },
      unknown,
    ][];
    expect(calls[0][0]).toEqual({ _id: id, revision: 1 });
    expect(calls[0][1].$set).toEqual({ label: 'Renamed' });
    expect(calls[0][1].$inc.revision).toBe(1);
    await s.service.replaceCredential(id, id, {
      secret: 'replacement-private-secret',
    });
    expect(calls[1][1].$set.ciphertext).toBeDefined();
    expect(calls[1][1].$set.lastValidationStatus).toBe('unknown');
  });
  it('rejects masked credential inputs without writing or auditing them', async () => {
    const s = setup();
    await expect(
      s.service.addCredential(id, providerId, {
        label: 'Key',
        secret: '**************',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.registry.credentials.create).not.toHaveBeenCalled();
    expect(s.activities.create).not.toHaveBeenCalled();
  });
  it('prevents removal of referenced credentials and archives unreferenced ones', async () => {
    const s = setup();
    await expect(s.service.deleteCredential(id, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    s.registry.providers.exists.mockResolvedValue(false);
    await s.service.deleteCredential(id, id);
    expect(s.registry.credentials.updateOne).toHaveBeenCalledWith(
      { _id: id },
      { $set: { enabled: false, archived: true }, $inc: { revision: 1 } },
    );
  });
  it('does not enable unimplemented adapters or change adapter identity', async () => {
    const s = setup();
    await expect(
      s.service.provider(id, {
        code: 'openai',
        name: 'OpenAI',
        adapter: 'openai',
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.service.provider(id, { adapter: 'anthropic' }, providerId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(s.registry.providers.create).not.toHaveBeenCalled();
  });
  it('preserves omitted provider flags during PATCH and audits only safe metadata', async () => {
    const s = setup();
    await s.service.provider(id, { name: 'Renamed' }, providerId);
    expect(s.registry.providers.findByIdAndUpdate).toHaveBeenCalledWith(
      providerId,
      {
        $set: {
          name: 'Renamed',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiVersion: 'v1beta',
        },
      },
      { returnDocument: 'after' },
    );
    expect(s.activities.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: id,
        metadata: { action: 'provider.update', recordId: providerId },
      }),
    );
  });
  it('fails closed before mutation when durable admin auditing fails', async () => {
    const s = setup();
    s.activities.create.mockRejectedValue(new Error('Audit unavailable'));
    await expect(
      s.service.provider(id, {
        code: 'google',
        name: 'Google',
        adapter: 'google',
      }),
    ).rejects.toThrow('Audit unavailable');
    expect(s.registry.providers.create).not.toHaveBeenCalled();
  });
  it('persists approved endpoints and advances provider revision when the API version changes', async () => {
    const s = setup();
    await s.service.provider(id, { apiVersion: 'v1' }, providerId);
    expect(s.registry.providers.findByIdAndUpdate).toHaveBeenCalledWith(
      providerId,
      {
        $set: {
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiVersion: 'v1',
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    );
    expect(s.registry.providers.updateOne).toHaveBeenCalledWith(
      { _id: providerId, revision: { $exists: false } },
      { $set: { revision: 1 } },
    );
  });
  it('rejects unsafe URL updates before auditing or mutating the provider', async () => {
    const s = setup();
    await expect(
      s.service.provider(id, { baseUrl: 'https://localhost' }, providerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.registry.providers.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(s.activities.create).not.toHaveBeenCalled();
  });
  it('keeps one Auto pointer during concurrent first-default updates, retrying insert collisions', async () => {
    const s = setup();
    let policy: { _id: string; modelId: string; revision: number } | undefined;
    const write = jest.fn(
      async (
        filter: { _id: string },
        update: { $set: { modelId: string } },
        options: { upsert?: boolean },
      ) => {
        const inserting = !policy;
        await Promise.resolve();
        if (inserting && policy && options.upsert)
          throw Object.assign(new Error('Duplicate policy'), { code: 11000 });
        policy = {
          _id: filter._id,
          modelId: update.$set.modelId,
          revision: (policy?.revision ?? 0) + 1,
        };
        return policy;
      },
    );
    Object.assign(s.registry, {
      configured: jest.fn(() =>
        Promise.resolve({
          model: { access: { allowedPlans: ['free'] } },
        }),
      ),
    });
    Object.assign(s.registry.routing, { findOneAndUpdate: write });
    await Promise.all([
      s.service.setDefault(id, id),
      s.service.setDefault(id, providerId),
    ]);
    expect(policy).toEqual({
      _id: 'editing-default',
      modelId: providerId,
      revision: 2,
    });
    expect(
      write.mock.calls.every(([filter]) => filter._id === 'editing-default'),
    ).toBe(true);
    expect(write.mock.calls.at(-1)?.[2]).toEqual({ returnDocument: 'after' });
  });
  it('reports stored credentials separately from usable bindings and tested models', async () => {
    const s = setup();
    const chain = (value: unknown) => {
      const result = {
        sort: () => result,
        skip: () => result,
        limit: () => result,
        lean: () => Promise.resolve(value),
      };
      return result;
    };
    Object.assign(s.registry.providers, { find: () => chain([s.provider]) });
    Object.assign(s.registry.credentials, {
      find: () => chain([{ ...s.credential, enabled: true }]),
    });
    Object.assign(s.registry.models, {
      find: () => chain([{ _id: id, credentialId: null }]),
    });
    Object.assign(s.registry, {
      configured: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('Needs binding')),
    });
    await expect(s.service.list('providers', {})).resolves.toMatchObject({
      items: [
        {
          credentialConfigured: true,
          credentialCount: 1,
          configured: false,
          validatedCredentialCount: 0,
          operational: false,
          modelCount: 1,
        },
      ],
    });
    Object.assign(s.registry.models, {
      find: () => chain([{ _id: id, credentialId: s.credential._id }]),
    });
    await expect(s.service.list('providers', {})).resolves.toMatchObject({
      items: [{ configured: true, operational: false }],
    });
  });
});

describe('Credential validation diagnostics', () => {
  const generationSuccess = JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'OK' }] } }],
  });
  afterEach(() => jest.restoreAllMocks());
  function validationSetup() {
    const s = setup();
    const encrypted = s.vault.encrypt(
      'synthetic-private-secret',
      providerId + ':' + id,
    );
    s.registry.credentials.findOne.mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue({ ...s.credential, ...encrypted, enabled: true }),
    });
    return s;
  }
  it.each([400, 401, 403, 429, 500])(
    'returns safe diagnostics for Google HTTP %s without its body or secret',
    async (status) => {
      const s = validationSetup();
      const body = 'synthetic-private-secret upstream-sensitive-body';
      const request = s.transport.fetch.mockResolvedValue(
        new Response(body, { status }),
      );
      const result = await s.service.validateCredential(id, id);
      expect(result).toMatchObject({
        valid: false,
        upstreamStatus: status,
        code:
          status === 429
            ? 'AI_QUOTA_OR_RATE_LIMIT'
            : status >= 500
              ? 'AI_PROVIDER_FAILED'
              : status === 400
                ? 'AI_REQUEST_FAILED'
                : 'AI_AUTH_OR_ACCESS_FAILED',
      });
      expect(JSON.stringify(result)).not.toContain('synthetic-private-secret');
      expect(JSON.stringify(result)).not.toContain('upstream-sensitive-body');
      expect(request).toHaveBeenCalledTimes(1);
      const updates = s.registry.credentials.updateOne.mock
        .calls as unknown as [
        unknown,
        { $set: { lastValidationStatus: string } },
      ][];
      expect(updates[0][0]).toEqual({
        _id: id,
        revision: 1,
        lastValidatedAt: null,
        enabled: true,
        archived: { $ne: true },
      });
      expect(updates[0][1].$set.lastValidationStatus).toBe('error');
    },
  );
  it('distinguishes decryption failures before contacting Google', async () => {
    const s = validationSetup();
    jest.spyOn(s.vault, 'decrypt').mockImplementation(() => {
      throw new Error('private cryptographic details');
    });
    const request = s.transport.fetch;
    const result = await s.service.validateCredential(id, id);
    expect(result).toMatchObject({
      valid: false,
      code: 'AI_CREDENTIAL_DECRYPT_FAILED',
    });
    expect(JSON.stringify(result)).not.toContain(
      'private cryptographic details',
    );
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['TimeoutError', 'TypeError'])(
    'distinguishes %s without leaking transport details',
    async (name) => {
      const s = validationSetup();
      const error = new Error('synthetic-private-secret transport details');
      error.name = name;
      s.transport.fetch.mockRejectedValue(error);
      const result = await s.service.validateCredential(id, id);
      expect(result).toMatchObject({
        valid: false,
        code: name === 'TimeoutError' ? 'AI_TIMEOUT' : 'AI_NETWORK_FAILED',
      });
      expect(JSON.stringify(result)).not.toContain('synthetic-private-secret');
    },
  );
  it('preserves the success response contract', async () => {
    const s = validationSetup();
    s.transport.fetch.mockResolvedValue(
      new Response(generationSuccess, { status: 200 }),
    );
    const result = await s.service.validateCredential(id, id);
    expect(result.valid).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(result).toMatchObject({ modelId: 'gemini-3.5-flash-lite' });
  });
  it('marks only a confirmed invalid-key rejection invalid and reports sanitized Google details', async () => {
    const s = validationSetup();
    s.transport.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: 'API key not valid.',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason: 'API_KEY_INVALID',
              },
            ],
          },
        }),
        { status: 400 },
      ),
    );
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      code: 'AI_AUTH_OR_ACCESS_FAILED',
      upstreamReason: 'API_KEY_INVALID',
    });
    expect(s.registry.credentials.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 1 }),
      { $set: expect.objectContaining({ lastValidationStatus: 'invalid' }) },
    );
  });
  it('decrypts the latest saved revision on each validation using its authenticated identity', async () => {
    const s = validationSetup();
    s.transport.fetch.mockImplementation(() =>
      Promise.resolve(new Response(generationSuccess, { status: 200 })),
    );
    await s.service.validateCredential(id, id);
    expect(
      (s.transport.fetch.mock.calls[0][1] as Request).headers.get(
        'x-goog-api-key',
      ),
    ).toBe('synthetic-private-secret');
    const updated = s.vault.encrypt(
      'synthetic-replacement-secret',
      providerId + ':' + id,
    );
    s.registry.credentials.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...s.credential,
        ...updated,
        revision: 2,
        enabled: true,
      }),
    });
    await s.service.validateCredential(id, id);
    expect(
      (s.transport.fetch.mock.calls[1][1] as Request).headers.get(
        'x-goog-api-key',
      ),
    ).toBe('synthetic-replacement-secret');
    expect(s.registry.credentials.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 2 }),
      { $set: expect.objectContaining({ lastValidationStatus: 'valid' }) },
    );
  });
  it('does not certify a credential replaced during validation', async () => {
    const s = validationSetup();
    s.transport.fetch.mockResolvedValue(
      new Response(generationSuccess, { status: 200 }),
    );
    s.registry.credentials.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: false,
      code: 'AI_PROVIDER_FAILED',
    });
  });
  it('does not certify a provider changed during validation', async () => {
    const s = validationSetup();
    s.transport.fetch.mockResolvedValue(
      new Response(generationSuccess, { status: 200 }),
    );
    s.registry.providers.exists.mockResolvedValue(false);
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: false,
      code: 'AI_PROVIDER_FAILED',
    });
  });
  it('fences validation metadata updates against a newer validation attempt', async () => {
    const s = validationSetup();
    const previous = new Date('2026-10-14T00:00:00Z');
    const saved = {
      ...s.credential,
      ...s.vault.encrypt('synthetic-private-secret', providerId + ':' + id),
      enabled: true,
      lastValidatedAt: previous,
    };
    s.registry.credentials.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    s.transport.fetch.mockResolvedValue(
      new Response(generationSuccess, { status: 200 }),
    );
    s.registry.credentials.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: false,
      code: 'AI_PROVIDER_FAILED',
    });
    expect(s.registry.credentials.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ lastValidatedAt: previous, revision: 1 }),
      expect.anything(),
    );
  });
  it('makes a fresh generation request and preserves valid identity on a later temporary failure', async () => {
    const s = validationSetup();
    const saved = {
      ...s.credential,
      ...s.vault.encrypt('synthetic-private-secret', providerId + ':' + id),
      enabled: true,
    };
    s.registry.credentials.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    s.transport.fetch.mockImplementation(() =>
      Promise.resolve(new Response(generationSuccess, { status: 200 })),
    );
    await s.service.validateCredential(id, id);
    Object.assign(
      saved,
      s.registry.credentials.updateOne.mock.calls[0][1].$set,
    );
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: true,
    });
    expect(s.transport.fetch).toHaveBeenCalledTimes(2);
    Object.assign(saved, { lastSuccessfulValidationAt: new Date(0) });
    s.transport.fetch.mockResolvedValueOnce(
      new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', {
        status: 429,
      }),
    );
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: false,
      code: 'AI_QUOTA_OR_RATE_LIMIT',
    });
    expect(s.registry.credentials.updateOne).toHaveBeenLastCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          lastValidationStatus: 'valid',
          lastValidationAttemptStatus: 'error',
          lastValidationErrorCode: 'RESOURCE_EXHAUSTED',
        }),
      },
    );
    expect(
      s.registry.credentials.updateOne.mock.calls.at(-1)![1].$set,
    ).not.toHaveProperty('lastSuccessfulValidationAt');
    expect(
      s.registry.credentials.updateOne.mock.calls.at(-1)![1].$set,
    ).not.toHaveProperty('enabled');
  });
  it('does not reuse an old success after provider configuration changes', async () => {
    const s = validationSetup();
    const saved = {
      ...s.credential,
      ...s.vault.encrypt('synthetic-private-secret', providerId + ':' + id),
      enabled: true,
    };
    s.registry.credentials.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    s.transport.fetch.mockImplementation(() =>
      Promise.resolve(new Response(generationSuccess, { status: 200 })),
    );
    await s.service.validateCredential(id, id);
    Object.assign(
      saved,
      s.registry.credentials.updateOne.mock.calls[0][1].$set,
    );
    Object.assign(s.provider, { revision: 2 });
    await s.service.validateCredential(id, id);
    expect(s.transport.fetch).toHaveBeenCalledTimes(2);
  });
  it('uses the configured routing model without a hardcoded probe model', async () => {
    const s = validationSetup();
    s.registry.routing.findById.mockResolvedValue({
      modelId: 'configured-model-record',
    });
    s.registry.models.findOne.mockResolvedValue({
      modelId: 'gemini-custom-supported-model',
      credentialId: id,
      settings: { maxOutputTokens: 4096 },
    });
    s.transport.fetch.mockResolvedValue(
      new Response(generationSuccess, { status: 200 }),
    );
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      modelId: 'gemini-custom-supported-model',
      valid: true,
    });
    expect((s.transport.fetch.mock.calls[0][1] as Request).url).toContain(
      '/models/gemini-custom-supported-model:generateContent',
    );
  });
  it('returns a configuration error without probing or marking the key invalid when no model is configured', async () => {
    const s = validationSetup();
    s.registry.models.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });
    await expect(s.service.validateCredential(id, id)).resolves.toMatchObject({
      valid: false,
      code: 'AI_REQUEST_FAILED',
    });
    expect(s.transport.fetch).not.toHaveBeenCalled();
    expect(s.registry.credentials.updateOne).toHaveBeenLastCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ lastValidationStatus: 'error' }) },
    );
  });
  it('excludes models bound to another credential, including an unrelated default routing model', async () => {
    const s = validationSetup();
    s.registry.routing.findById.mockResolvedValue({
      modelId: 'unrelated-model-record',
    });
    s.registry.models.findOne.mockImplementation((...args: unknown[]) => {
      const query = args[0] as Record<string, unknown>;
      expect(query.$or).toEqual([{ credentialId: id }, { credentialId: null }]);
      return Object.assign(Promise.resolve(null), {
        sort: jest.fn().mockResolvedValue(null),
      });
    });
    const result = await s.service.validateCredential(id, id);
    expect(result).toMatchObject({
      valid: false,
      category: 'configuration_error',
      credentialStatus: 'undetermined',
    });
    expect(s.transport.fetch).not.toHaveBeenCalled();
  });
  it('allows unbound models when this credential is the provider default', async () => {
    const s = validationSetup();
    Object.assign(s.provider, { defaultCredentialId: id });
    s.registry.models.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });
    await s.service.validateCredential(id, id);
    expect(s.registry.models.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [{ credentialId: id }, { credentialId: null }],
      }),
    );
  });
  it.each([404, 400, 403, 429, 503])(
    'preserves prior credential identity on unrelated HTTP %s failures with a different model context',
    async (status) => {
      const s = validationSetup();
      s.registry.credentials.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...s.credential,
          ...s.vault.encrypt('synthetic-private-secret', providerId + ':' + id),
          enabled: true,
          lastValidationStatus: 'valid',
          lastValidationContext: 'previous-model-context',
        }),
      });
      s.transport.fetch.mockResolvedValue(new Response('{}', { status }));
      const result = await s.service.validateCredential(id, id);
      expect(result).toMatchObject({
        valid: false,
        credentialStatus: 'undetermined',
        modelAccessStatus: 'undetermined',
      });
      expect(s.registry.credentials.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({
            lastValidationStatus: 'valid',
            lastValidationAttemptStatus: 'error',
          }),
        },
      );
      expect(
        s.registry.credentials.updateOne.mock.calls[0][1].$set,
      ).not.toHaveProperty('enabled');
    },
  );
});

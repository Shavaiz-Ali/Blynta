import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { CredentialVault } from './credential-vault.service';
import {
  credentialInput,
  modelInput,
  providerInput,
  providedFields,
} from './registry.contract';
import { ModelRegistry } from './model-registry.service';
import {
  ProviderSchema,
  CredentialSchema,
  ModelSchema,
  UsageSchema,
  AIModel,
  AIProvider,
  AICredential,
  AIRouting,
  AIUsage,
} from './registry.schemas';
import { User, UserPlan } from '../users/schemas/user.schema';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AdminAIController } from './registry.controllers';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GoogleAdapter, providerError } from './google-adapter.service';
const id = '111111111111111111111111';
const providerId = '222222222222222222222222';
const credentialId = '333333333333333333333333';
const q = <T>(value: T) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
  then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve),
});
function setup(plan = UserPlan.PRO) {
  const vault = new CredentialVault(
    new ConfigService({
      AI_CREDENTIAL_KEYS: JSON.stringify({
        v1: randomBytes(32).toString('base64'),
      }),
      AI_CREDENTIAL_KEY_VERSION: 'v1',
    }),
  );
  const model = {
    _id: id,
    ...modelInput.parse({
      providerId,
      credentialId,
      modelId: 'gemini-test',
      displayName: 'Test model',
      enabled: true,
      capabilities: {
        text: true,
        vision: false,
        audioInput: false,
        structuredOutput: true,
        toolCalling: false,
      },
      settings: { maxOutputTokens: 512, timeoutMs: 1000, maxRetries: 0 },
      access: { allowedPlans: ['free', 'pro'], selectable: true },
    }),
    archived: false,
    lastTestStatus: 'valid',
    testedCredentialId: credentialId,
    testedCredentialRevision: 1,
  };
  const provider = {
    _id: providerId,
    adapter: 'google',
    enabled: true,
    code: 'google',
    defaultCredentialId: credentialId,
  };
  const credential = {
    _id: credentialId,
    providerId,
    enabled: true,
    revision: 1,
    ...vault.encrypt(
      'test-secret-do-not-expose',
      providerId + ':' + credentialId,
    ),
  };
  const providers = { findOne: jest.fn(() => q(provider)) },
    credentials = { findOne: jest.fn(() => q(credential)) },
    models = { findOne: jest.fn(() => q(model)) },
    routing = { findById: jest.fn(() => q({ modelId: id })) },
    usage = { updateOne: jest.fn().mockResolvedValue({}) },
    users = { findOne: jest.fn(() => q({ plan })) };
  const registry = new ModelRegistry(
    providers as unknown as Model<AIProvider>,
    credentials as unknown as Model<AICredential>,
    models as unknown as Model<AIModel>,
    routing as unknown as Model<AIRouting>,
    usage as unknown as Model<AIUsage>,
    users as unknown as Model<User>,
    vault,
  );
  return {
    registry,
    model,
    provider,
    credential,
    providers,
    credentials,
    models,
    routing,
    usage,
    users,
  };
}
describe('AI credential vault', () => {
  const key = randomBytes(32).toString('base64');
  const vault = (version = 'v1') =>
    new CredentialVault(
      new ConfigService({
        AI_CREDENTIAL_KEYS: JSON.stringify({
          v1: key,
          v2: randomBytes(32).toString('base64'),
        }),
        AI_CREDENTIAL_KEY_VERSION: version,
      }),
    );
  it('encrypts secrets with unique random IVs and authenticates identity', () => {
    const v = vault();
    const first = v.encrypt('secret', 'provider:credential'),
      second = v.encrypt('secret', 'provider:credential');
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toContain('secret');
    expect(v.decrypt(first, 'provider:credential')).toBe('secret');
    expect(() => v.decrypt(first, 'other:credential')).toThrow(
      ServiceUnavailableException,
    );
  });
  it.each(['ciphertext', 'tag', 'iv', 'keyVersion'] as const)(
    'rejects tampered %s',
    (field) => {
      const v = vault(),
        sealed = v.encrypt('secret', 'id');
      sealed[field] = 'invalid';
      expect(() => v.decrypt(sealed, 'id')).toThrow(
        ServiceUnavailableException,
      );
    },
  );
  it('retains old key compatibility during rotation', () => {
    const old = vault().encrypt('secret', 'id');
    expect(vault('v2').decrypt(old, 'id')).toBe('secret');
    expect(vault('v2').encrypt('new', 'id').keyVersion).toBe('v2');
  });
  it('fails closed for missing or wrong-length master keys', () => {
    expect(() =>
      new CredentialVault(new ConfigService()).encrypt('secret', 'id'),
    ).toThrow(ServiceUnavailableException);
    expect(() =>
      new CredentialVault(
        new ConfigService({ AI_CREDENTIAL_KEYS: '{"v1":"short"}' }),
      ).encrypt('secret', 'id'),
    ).toThrow(ServiceUnavailableException);
  });
  it('rejects masked replacements and keeps PATCH omission intact', () => {
    expect(
      credentialInput.safeParse({ label: 'Key', secret: '••••••••••••' })
        .success,
    ).toBe(false);
    expect(
      providedFields(providerInput.partial().parse({ name: 'New' }), {
        name: 'New',
      }),
    ).toEqual({ name: 'New' });
  });
  it('hides all cipher fields by default and defines uniqueness indexes', () => {
    for (const field of ['ciphertext', 'iv', 'tag', 'keyVersion'])
      expect(CredentialSchema.path(field).options.select).toBe(false);
    expect(ProviderSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ code: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
    expect(ModelSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { providerId: 1, modelId: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
    expect(UsageSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { executionId: 1, call: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
  });
});
describe('AI registry routing and policies', () => {
  it('does not treat old editing-only models as highlight-capable', async () => {
    const s = setup();
    await expect(
      s.registry.resolveUserModel(id, id, 'highlight_detection'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    s.model.tasks = ['highlight_detection'];
    expect(
      (await s.registry.resolveUserModel(id, id, 'highlight_detection')).model,
    ).toBe(s.model);
    await expect(
      s.registry.resolveUserModel(id, id, 'edit_planning'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('initializes the implemented LangChain Google adapter from resolved encrypted credentials', async () => {
    const s = setup();
    const resolved = await s.registry.resolveUserModel(id, id);
    const client = new GoogleAdapter().create(resolved.model, resolved.secret);
    expect(client.model).toBe('gemini-test');
    expect(JSON.stringify(client.toJSON())).not.toContain(
      'test-secret-do-not-expose',
    );
    expect(resolved.secret).toBe('test-secret-do-not-expose');
  });
  it('free accounts cannot override Auto through payloads', async () => {
    await expect(
      setup(UserPlan.FREE).registry.resolveUserModel(id, id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('free accounts use the deterministic configured default', async () => {
    const s = setup(UserPlan.FREE);
    expect((await s.registry.resolveUserModel(id)).auto).toBe(true);
    expect(s.routing.findById).toHaveBeenCalledWith('editing-default');
  });
  it('rejects an unauthorized Pro model and nonselectable models', async () => {
    const s = setup();
    s.model.access.allowedPlans = ['free'];
    await expect(s.registry.resolveUserModel(id, id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    s.model.access.allowedPlans = ['pro'];
    s.model.access.selectable = false;
    await expect(s.registry.resolveUserModel(id, id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('Business has no implicit access to all models', async () => {
    await expect(
      setup(UserPlan.BUSINESS).registry.resolveUserModel(id, id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['disabled', 'untested', 'missing-capability', 'replaced-key'])(
    'rejects %s models',
    async (reason) => {
      const s = setup();
      if (reason === 'disabled') s.model.enabled = false;
      if (reason === 'untested') s.model.lastTestStatus = 'unknown';
      if (reason === 'missing-capability')
        s.model.capabilities.structuredOutput = false;
      if (reason === 'replaced-key') s.credential.revision = 2;
      await expect(s.registry.resolveUserModel(id, id)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('checks enabled credential/provider predicates and fails for missing credentials', async () => {
    const s = setup();
    await s.registry.configured(id);
    expect(s.credentials.findOne).toHaveBeenCalledWith({
      _id: credentialId,
      providerId,
      enabled: true,
      archived: { $ne: true },
    });
    expect(s.providers.findOne).toHaveBeenCalledWith({
      _id: providerId,
      enabled: true,
      adapter: 'google',
    });
    s.credentials.findOne.mockImplementation(() => q(null) as never);
    await expect(s.registry.configured(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('does not silently choose a random model when default is absent', async () => {
    const s = setup();
    s.routing.findById.mockImplementation(() => q(null) as never);
    await expect(s.registry.resolveUserModel(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(s.models.findOne).not.toHaveBeenCalled();
  });
  it('reads current account entitlement on every request without billing mutations', async () => {
    const s = setup();
    await s.registry.resolveUserModel(id, id);
    s.users.findOne.mockImplementation(() => q({ plan: UserPlan.FREE }));
    await expect(s.registry.resolveUserModel(id, id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(s.users.findOne).toHaveBeenCalledTimes(2);
  });
  it('deduplicates usage by execution and call', async () => {
    const s = setup();
    await s.registry.recordUsage({
      executionId: 'run',
      call: 1,
      userId: id,
      modelId: id,
      providerId,
      taskType: 'edit_proposal',
      latencyMs: 10,
      status: 'success',
    });
    expect(s.usage.updateOne).toHaveBeenCalledWith(
      { executionId: 'run', call: 1 },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          executionId: 'run',
        }) as unknown,
      }),
      { upsert: true },
    );
  });
  it('protects all administration with JWT and the existing privileged session guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminAIController,
    ) as unknown[];
    expect(guards).toContain(AdminGuard);
    expect(guards).toHaveLength(3);
  });
  it('sanitizes provider errors without including secret-bearing messages', () => {
    expect(providerError({ status: 403, message: 'SECRET' })).toBe(
      'AI_AUTH_FAILED',
    );
    expect(providerError({ status: 429 })).toBe('AI_QUOTA_OR_RATE_LIMIT');
    expect(providerError(new DOMException('SECRET', 'TimeoutError'))).toBe(
      'AI_TIMEOUT',
    );
  });
});

import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AdminAIService } from './admin-ai.service';
import { ModelRegistry } from './model-registry.service';
import { GoogleAdapter } from './google-adapter.service';
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
      findByIdAndUpdate: jest.fn().mockResolvedValue(provider),
      create: jest.fn().mockResolvedValue(provider),
    },
    credentials: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockResolvedValue(credential),
      findOneAndUpdate: jest.fn(() => ({
        orFail: jest.fn().mockResolvedValue(metadata),
      })),
      updateOne: jest.fn().mockResolvedValue({}),
    },
    models: { exists: jest.fn().mockResolvedValue(false) },
    routing: { exists: jest.fn().mockResolvedValue(false) },
  };
  const activities = { create: jest.fn().mockResolvedValue({}) };
  const vault = new CredentialVault(
    new ConfigService({
      AI_CREDENTIAL_KEYS: JSON.stringify({
        v1: randomBytes(32).toString('base64'),
      }),
    }),
  );
  const service = new AdminAIService(
    registry as unknown as ModelRegistry,
    vault,
    {} as GoogleAdapter,
    activities as unknown as ActivitiesService,
  );
  return { service, registry, activities, vault, credential };
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
      { $set: { name: 'Renamed' } },
      { new: true },
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
});

import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  HighlightRouting,
  highlightModelHash,
} from './highlight-routing.service';
import { ModelRegistry } from './model-registry.service';
import { modelInput } from './registry.contract';
const id = '111111111111111111111111';
function setup() {
  const model = {
    _id: id,
    ...modelInput.parse({
      providerId: id,
      modelId: 'gemini-test',
      displayName: 'Registered',
      enabled: true,
      tasks: ['highlight_detection'],
      capabilities: {
        text: true,
        vision: false,
        audioInput: false,
        structuredOutput: true,
        toolCalling: false,
      },
      settings: { maxOutputTokens: 4096, timeoutMs: 1000 },
      access: { allowedPlans: ['free', 'pro'], selectable: true },
    }),
    archived: false,
  };
  const registry = {
    routing: { findById: jest.fn().mockResolvedValue({ modelId: id }) },
    resolveUserModel: jest
      .fn()
      .mockResolvedValue({ model, secret: 'synthetic-provider-secret' }),
  };
  return {
    model,
    registry,
    service: new HighlightRouting(registry as unknown as ModelRegistry),
  };
}
describe('highlight task routing', () => {
  it('pins database identity and settings without persisting secrets', async () => {
    const s = setup();
    const result = await s.service.select(id, id);
    expect(s.registry.resolveUserModel).toHaveBeenCalledWith(
      id,
      id,
      'highlight_detection',
    );
    expect(result).toEqual({
      registryId: id,
      providerId: id,
      modelId: 'gemini-test',
      configurationHash: highlightModelHash(s.model),
      auto: false,
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('permits legacy Auto only when no routing policy has been bootstrapped', async () => {
    const s = setup();
    s.registry.routing.findById.mockResolvedValue(null);
    expect(await s.service.select(id)).toBeUndefined();
    expect(s.registry.resolveUserModel).not.toHaveBeenCalled();
    await s.service.select(id, id);
    expect(s.registry.resolveUserModel).toHaveBeenCalled();
  });
  it('never substitutes legacy configuration when a default is unavailable', async () => {
    const s = setup();
    s.registry.resolveUserModel.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await expect(s.service.select(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('reevaluates free entitlements for explicit model selections', async () => {
    const s = setup();
    const selection = await s.service.select(id, id);
    s.registry.resolveUserModel.mockRejectedValue(new ForbiddenException());
    await expect(s.service.resolve(id, selection!)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('pins Auto to the original database model despite later default changes', async () => {
    const s = setup();
    const selection = await s.service.select(id);
    await s.service.resolve(id, selection!);
    expect(s.registry.resolveUserModel).toHaveBeenLastCalledWith(
      id,
      undefined,
      'highlight_detection',
      id,
    );
  });
  it('rejects changed model configuration instead of mixing provider/cache identities', async () => {
    const s = setup();
    const selection = await s.service.select(id, id);
    s.model.settings.maxOutputTokens = 2048;
    await expect(s.service.resolve(id, selection!)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

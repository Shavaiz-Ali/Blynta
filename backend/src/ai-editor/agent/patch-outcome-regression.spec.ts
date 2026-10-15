import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { ProviderAdapterRegistry } from '../../ai-registry/provider-adapter.registry';
import { GoogleAdapter } from '../../ai-registry/google-adapter.service';
import { ModelRegistry } from '../../ai-registry/model-registry.service';
import { R2Service } from '../../storage/r2.service';
import type { StudioAsset } from '../../studio/studio.schemas';
import { EditPlanValidatorService } from '../edit-plan-validator.service';
import { parseEdit, planSchema } from '../edit-plan.contract';
import { buildRenderSpec } from '../ffmpeg-edit-renderer';
import { AgentTools } from './agent-tools.service';
import { editPatchSchema, mergeEditPatch } from './edit-patch';
import { EditingGraph } from './editing-graph.service';

const instruction =
  'Add a 😂 emoji overlay at the center for the entire video.';
const id = '111111111111111111111111';
const failure = {
  outcome: 'clarification',
  summary:
    'Adding an emoji overlay for the entire video duration is not supported.',
  patchJson: '{"baseRevision":1,"changes":[]}',
  unavailableCapabilities: [],
};
const patch = {
  baseRevision: 1,
  changes: [
    {
      action: 'add',
      operation: {
        id: 'overlay',
        type: 'emoji_overlay',
        start: 0,
        end: 58,
        params: {
          assetId: 'sanitized-emoji',
          emoji: '😂',
          x: 0.5,
          y: 0.5,
          width: 0.2,
        },
      },
    },
  ],
};
const validAnswer = {
  outcome: 'proposal',
  summary: 'Center the emoji for the full duration.',
  patchJson: JSON.stringify(patch),
  unavailableCapabilities: [],
};
function setup(answers: unknown[]) {
  const plan = parseEdit(planSchema, {
    schemaVersion: 1,
    timestampSystem: 'output_seconds',
    video: {
      segments: [{ id: 'main', type: 'video', sourceStart: 0, sourceEnd: 58 }],
    },
    audio: { original: {}, tracks: [] },
    operations: [],
  });
  const asset = {
    userId: id,
    assetId: 'sanitized-emoji',
    kind: 'image',
    mimeType: 'image/png',
    width: 256,
    height: 256,
    size: 1000,
    storageKey: 'synthetic-private-key',
  };
  const assets = {
    find: jest.fn((filter: { userId: string; assetId: string }) => ({
      limit: () => ({
        lean: () =>
          Promise.resolve(
            filter.userId === id && filter.assetId === asset.assetId
              ? [asset]
              : [],
          ),
      }),
    })),
  };
  const validator = new EditPlanValidatorService(
    assets as unknown as Model<StudioAsset>,
    {
      objectInfo: () =>
        Promise.resolve({ size: 1000, contentType: 'image/png' }),
    } as unknown as R2Service,
  );
  const invoke = <T>(fn: () => T) => ({ invoke: () => Promise.resolve(fn()) });
  const resolveAsset = jest.fn().mockResolvedValue({
    assetId: asset.assetId,
    mimeType: 'image/png',
    width: 256,
    height: 256,
  });
  const validate = jest.fn(async (value: unknown) => {
    const merged = mergeEditPatch(plan, 1, value);
    await validator.validate(id, merged.plan, 58);
    buildRenderSpec(
      merged.plan,
      {
        path: 'synthetic.mp4',
        hasAudio: true,
        duration: 58,
        width: 1280,
        height: 720,
      },
      new Map([
        [
          asset.assetId,
          {
            path: 'synthetic.png',
            hasAudio: false,
            duration: 0,
            width: 256,
            height: 256,
          },
        ],
      ]),
      '.',
    );
    return { valid: true };
  });
  const tools = {
    scoped: () => ({
      context: invoke(() => ({
        revision: 1,
        outputDuration: 58,
        sourceDuration: 58,
      })),
      plan: invoke(() => plan),
      assets: invoke(() => []),
      resolveAsset,
      validate: { invoke: validate },
    }),
  };
  const outputs: unknown[] = [
    {
      phrases: [],
      clarification: '',
      unsupported: '',
      assets: [{ kind: 'emoji', query: '😂' }],
    },
    ...answers,
  ];
  const payloads: string[] = [];
  const adapter = {
    structured: jest.fn(
      (
        _model: unknown,
        _secret: string,
        _schema: unknown,
        _system: string,
        payload: string,
      ) => {
        payloads.push(payload);
        return Promise.resolve({ parsed: outputs.shift() });
      },
    ),
  };
  const registry = {
    resolveUserModel: () =>
      Promise.resolve({
        model: {
          _id: id,
          providerId: id,
          modelId: 'synthetic-model',
          settings: { timeoutMs: 1000 },
        },
        provider: { adapter: 'google' },
        secret: 'PRIVATE-TEST-KEY',
      }),
    recordUsage: async () => {},
  };
  const nodes: string[] = [];
  const graph = new EditingGraph(
    tools as unknown as AgentTools,
    registry as unknown as ModelRegistry,
    new ProviderAdapterRegistry(adapter as unknown as GoogleAdapter),
  );
  return {
    plan,
    validate,
    resolveAsset,
    payloads,
    nodes,
    run: () =>
      graph.run({
        userId: id,
        clipId: id,
        planId: id,
        prompt: instruction,
        history: [],
        executionId: 'synthetic-patch-regression',
        signal: AbortSignal.timeout(10000),
        onTool: async () => {},
        onStage: (node) => {
          nodes.push(node);
          return Promise.resolve();
        },
      }),
  };
}
describe('generate_patch outcome regressions: no provider or render calls', () => {
  it('recovers the exact historical patch through its complete structured-output hash and reports the precise Zod issue', () => {
    expect(
      createHash('sha256').update(JSON.stringify(failure)).digest('hex'),
    ).toBe('24cb406d21d6a88a959d096de044adff49d3d07f0ba504125385d36194466909');
    const result = editPatchSchema.safeParse(
      JSON.parse(failure.patchJson) as unknown,
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual([
        {
          origin: 'array',
          code: 'too_small',
          minimum: 1,
          inclusive: true,
          path: ['changes'],
          message: 'Too small: expected array to have >=1 items',
        },
      ]);
  });
  it('passes the exact request with a valid owned overlay patch and exposes the actual planner inputs', async () => {
    const s = setup([validAnswer]);
    expect(await s.run()).toMatchObject({
      status: 'pending',
      patch: { baseRevision: 1 },
    });
    expect(s.resolveAsset).toHaveBeenCalledTimes(1);
    expect(s.validate).toHaveBeenCalledTimes(1);
    expect(s.plan.operations).toHaveLength(0);
    const input = JSON.parse(s.payloads[1]) as {
      context: string;
      resolvedAssets: string;
      patchContract: object;
    };
    const context = JSON.parse(input.context) as {
      clip: { outputDuration: number };
      plan: { timestampSystem: string };
      capabilities: {
        operations: string[];
        overlayCoordinates: { center: object };
      };
    };
    expect(context.clip.outputDuration).toBe(58);
    expect(context.plan.timestampSystem).toBe('output_seconds');
    expect(context.capabilities.operations).toContain('emoji_overlay');
    expect(context.capabilities.overlayCoordinates.center).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(input.resolvedAssets).toContain('sanitized-emoji');
    expect(input.patchContract).toBeDefined();
    expect(s.nodes).toEqual([
      'load_context',
      'interpret',
      'resolve_information',
      'resolve_assets',
      'generate_patch',
      'validate',
    ]);
  });
  it('reproduces the currently deployed false USER_INPUT_REQUIRED outcome', async () => {
    const s = setup([failure]);
    expect(await s.run()).toMatchObject({
      status: 'clarification',
      summary: failure.summary,
      patch: undefined,
    });
    expect(s.resolveAsset).toHaveBeenCalledTimes(1);
    expect(s.validate).not.toHaveBeenCalled();
    expect(s.nodes).not.toContain('correct');
  });
  it('REGRESSION: corrects an invalid patch instead of treating it as missing user information', async () => {
    const s = setup([failure, validAnswer]);
    expect(await s.run()).toMatchObject({ status: 'pending' });
    expect(s.nodes).toContain('correct');
  });
  it('REGRESSION: repeated invalid model patches fail internally rather than returning clarification', async () => {
    const s = setup([failure, failure]);
    await expect(s.run()).rejects.toMatchObject({
      response: { code: 'AI_PATCH_INVALID' },
    });
  });
  it('REGRESSION: an unsupported natural-language summary cannot contradict a validated supported proposal', async () => {
    const s = setup([{ ...validAnswer, summary: failure.summary }]);
    const result = await s.run();
    expect(result.status).toBe('pending');
    expect(result.summary).not.toMatch(/not supported/i);
  });
});

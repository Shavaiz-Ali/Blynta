import { ProviderAdapterRegistry } from '../../ai-registry/provider-adapter.registry';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { AgentTools } from './agent-tools.service';
import { EditingGraph } from './editing-graph.service';
import { examplePlan } from '../edit-plan.fixture';
import { EditPlanValidatorService } from '../edit-plan-validator.service';
import type { StoredEditPlan } from '../edit.schemas';
import type { StudioAsset } from '../../studio/studio.schemas';
import { R2Service } from '../../storage/r2.service';
import { Job } from '../../jobs/schemas/job.schema';
import { GoogleAdapter } from '../../ai-registry/google-adapter.service';
import { ModelRegistry } from '../../ai-registry/model-registry.service';
import type { AIUsage } from '../../ai-registry/registry.schemas';
import { EmojiAssetsService } from './emoji-assets.service';
const id = '111111111111111111111111',
  clipId = '222222222222222222222222';
const patch = {
  baseRevision: 1,
  changes: [
    {
      action: 'add',
      operation: {
        id: 'zoom',
        type: 'zoom',
        start: 0,
        end: 1,
        params: {
          fromScale: 1,
          toScale: 1.2,
          focusX: 0.5,
          focusY: 0.5,
          easing: 'linear',
        },
      },
    },
  ],
};
const intent = { phrases: [], clarification: '', unsupported: '' };
const answer = {
  outcome: 'proposal',
  summary: 'Add a zoom',
  patchJson: JSON.stringify(patch),
};
const query = <T>(value: T) => ({
  maxTimeMS: jest.fn().mockResolvedValue(value),
});
const requestedCases = [
  { prompt: 'Lower the original audio volume to 50%.', kind: 'gain' },
  { prompt: 'Add a zoom from 00:05 to 00:10.', kind: 'zoom' },
  {
    prompt: 'Add a 😂 emoji at the center for the entire video.',
    kind: 'emoji',
  },
  {
    prompt: 'Add a zoom from 00:05 to 00:10 and lower audio volume to 50%.',
    kind: 'combined',
  },
] as const;
function setup(outputs: unknown[] = [intent, answer]) {
  const library: Partial<StudioAsset>[] = [];
  const plan = {
    _id: id,
    userId: id,
    sourceClipId: clipId,
    revision: 1,
    sourceMedia: { jobId: id, clipId, storageKey: 'private-key', duration: 3 },
    plan: examplePlan(),
    outputDuration: 3,
  };
  const plans = { findOne: jest.fn(() => query(plan)) };
  const jobs = {
    findOne: jest.fn(() =>
      query({
        clips: [{ _id: clipId, startTime: 10, endTime: 13 }],
        transcript: [{ startTime: 10, endTime: 11, text: 'Hello world' }],
      }),
    ),
  };
  const assets = {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      lean: jest.fn().mockImplementation(() => Promise.resolve(library)),
    })),
  };
  const validator = new EditPlanValidatorService(
    assets as unknown as Model<StudioAsset>,
    {
      objectInfo: jest
        .fn()
        .mockResolvedValue({ size: 1000, contentType: 'image/png' }),
    } as unknown as R2Service,
  );
  const generated = {
    assetId: 'emoji-real',
    mimeType: 'image/png',
    width: 256,
    height: 256,
  };
  const emoji = {
    generateShape: jest.fn().mockImplementation(() => {
      library.push({
        ...generated,
        assetId: 'shape-real',
        name: 'blue arrow',
        kind: 'image',
        size: 1000,
        status: 'ready',
      });
      return Promise.resolve({ ...generated, assetId: 'shape-real' });
    }),
    generate: jest.fn().mockImplementation(() => {
      library.push({
        ...generated,
        name: '😂 emoji',
        kind: 'image',
        size: 1000,
        status: 'ready',
      });
      return Promise.resolve(generated);
    }),
  };
  const tools = new AgentTools(
    plans as unknown as Model<StoredEditPlan>,
    jobs as unknown as Model<Job>,
    assets as unknown as Model<StudioAsset>,
    validator,
    emoji as unknown as EmojiAssetsService,
  );
  const registry = {
    resolveUserModel: jest.fn().mockResolvedValue({
      model: {
        _id: id,
        providerId: id,
        settings: { timeoutMs: 1000 },
        pricing: {
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
          currency: 'USD',
        },
      },
      provider: { adapter: 'google' },
      secret: 'not-in-tools',
      plan: 'pro',
    }),
    recordUsage: jest.fn((_input: AIUsage) => {
      void _input;
      return Promise.resolve();
    }),
  };
  let cursor = 0;
  const google = {
    structured: jest.fn().mockImplementation(() =>
      Promise.resolve({
        parsed: outputs[cursor++],
        usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      }),
    ),
  };
  const graph = new EditingGraph(
    tools,
    registry as unknown as ModelRegistry,
    new ProviderAdapterRegistry(google as unknown as GoogleAdapter),
  );
  const onTool = jest.fn((_name: string, _result: unknown) => {
    void _name;
    void _result;
    return Promise.resolve();
  });
  const onStage = jest.fn((_stage: string) => {
    void _stage;
    return Promise.resolve();
  });
  const run = (
    prompt = 'Add a zoom',
    options: { signal?: AbortSignal; deadlineAt?: number } = {},
  ) =>
    graph.run({
      userId: id,
      clipId,
      planId: id,
      prompt,
      history: [],
      executionId: 'execution',
      signal: AbortSignal.timeout(10000),
      onTool,
      onStage,
      ...options,
    });
  return {
    run,
    graph,
    tools,
    plans,
    jobs,
    assets,
    plan,
    registry,
    google,
    onTool,
    onStage,
    emoji,
    library,
  };
}
describe('Bounded LangGraph proposal integration', () => {
  it.each(requestedCases)(
    'validates the exact request and corrects an unverified model veto: $prompt',
    async ({ prompt, kind }) => {
      const zoom = {
        action: 'add',
        operation: { ...patch.changes[0].operation, start: 5, end: 10 },
      };
      const gain = {
        action: 'update_original_audio',
        controls: { ...examplePlan().audio.original, gain: 0.5 },
      };
      const overlay = {
        action: 'add',
        operation: {
          id: 'emoji',
          type: 'emoji_overlay',
          start: 0,
          end: 58,
          params: {
            assetId: 'emoji-real',
            emoji: '😂',
            x: 0.5,
            y: 0.5,
            width: 0.2,
          },
        },
      };
      const changes =
        kind === 'gain'
          ? [gain]
          : kind === 'zoom'
            ? [zoom]
            : kind === 'emoji'
              ? [overlay]
              : [zoom, gain];
      const s = setup([
        {
          ...intent,
          assets: kind === 'emoji' ? [{ kind: 'emoji', query: '😂' }] : [],
        },
        {
          outcome: 'unsupported',
          summary: 'This entire request is unsupported',
          patchJson: '',
        },
        { ...answer, patchJson: JSON.stringify({ baseRevision: 1, changes }) },
      ]);
      s.plan.sourceMedia.duration = 58;
      s.plan.outputDuration = 58;
      const segment = s.plan.plan.video.segments[0];
      if (segment.type === 'video') segment.sourceEnd = 58;
      const result = await s.run(prompt);
      expect(result).toMatchObject({ status: 'pending', calls: 3 });
      expect(result.patch?.changes).toHaveLength(changes.length);
      expect(s.onStage.mock.calls.map(([node]) => node)).toEqual([
        'load_context',
        'interpret',
        'resolve_information',
        'resolve_assets',
        'generate_patch',
        'validate',
        'correct',
        'validate',
      ]);
      expect(
        s.onTool.mock.calls.some(([name]) => name === 'validate_edit_patch'),
      ).toBe(true);
      expect(s.emoji.generate).toHaveBeenCalledTimes(kind === 'emoji' ? 1 : 0);
      expect(s.plan.revision).toBe(1);
      expect(s.plan.plan.operations).toHaveLength(0);
    },
  );
  it('does not persist unsupported when the model repeats an unverified veto', async () => {
    const veto = {
      outcome: 'unsupported',
      summary: 'Center overlays are unsupported',
      patchJson: '',
    };
    const s = setup([intent, veto, veto]);
    await expect(s.run()).rejects.toMatchObject({
      response: { code: 'AI_UNVERIFIED_UNSUPPORTED' },
    });
    expect(s.google.structured).toHaveBeenCalledTimes(3);
  });
  it('resolves a deterministic shape and its requested color into an image operation', async () => {
    const shapePatch = {
      baseRevision: 1,
      changes: [
        {
          action: 'add',
          operation: {
            id: 'arrow',
            type: 'image_overlay',
            start: 0,
            end: 3,
            params: { assetId: 'shape-real', x: 0.5, y: 0.5, width: 0.2 },
          },
        },
      ],
    };
    const s = setup([
      {
        ...intent,
        assets: [{ kind: 'shape', query: 'arrow', color: '#0000ff' }],
      },
      { ...answer, patchJson: JSON.stringify(shapePatch) },
    ]);
    expect(await s.run('Add a blue arrow')).toMatchObject({
      status: 'pending',
    });
    expect(s.emoji.generateShape).toHaveBeenCalledWith(id, 'arrow', '#0000ff');
  });
  it('resolves an emoji even when interpretation prematurely says unsupported, and preserves a second edit', async () => {
    const emojiPatch = {
      ...patch,
      changes: [
        ...patch.changes,
        {
          action: 'add',
          operation: {
            id: 'laugh',
            type: 'image_overlay',
            start: 0,
            end: 3,
            params: {
              assetId: 'emoji-real',
              x: 0.5,
              y: 0.5,
              width: 0.2,
              opacity: 1,
            },
          },
        },
      ],
    };
    const s = setup([
      {
        ...intent,
        unsupported: 'Needs an emoji asset',
        assets: [{ kind: 'emoji', query: '😂' }],
      },
      { ...answer, patchJson: JSON.stringify(emojiPatch) },
    ]);
    const result = await s.run(
      'Add 😂 at the center for the whole video, and zoom in at the beginning.',
    );
    expect(s.emoji.generate).toHaveBeenCalledWith(id, '😂');
    expect(result.status).toBe('pending');
    expect(result.patch?.changes).toHaveLength(2);
    expect(s.plan.plan.operations).toHaveLength(0);
    expect((s.google.structured.mock.calls as unknown[][])[1][4]).toContain(
      'emoji-real',
    );
  });
  it('asks for selection when multiple uploaded assets match', async () => {
    const s = setup([
      { ...intent, assets: [{ kind: 'image', query: 'logo' }] },
    ]);
    s.library.push({ name: 'logo blue' }, { name: 'logo white' });
    expect(await s.run()).toMatchObject({
      status: 'clarification',
      patch: undefined,
    });
    expect(s.google.structured).toHaveBeenCalledTimes(1);
  });
  it('resolves an existing owned PNG and validates its media before proposing', async () => {
    const imagePatch = {
      baseRevision: 1,
      changes: [
        {
          action: 'add',
          operation: {
            id: 'logo',
            type: 'image_overlay',
            start: 0,
            end: 3,
            params: { assetId: 'logo-owned', x: 1, y: 0, width: 0.2 },
          },
        },
      ],
    };
    const s = setup([
      { ...intent, assets: [{ kind: 'image', query: 'logo' }] },
      { ...answer, patchJson: JSON.stringify(imagePatch) },
    ]);
    s.library.push({
      name: 'logo',
      assetId: 'logo-owned',
      kind: 'image',
      mimeType: 'image/png',
      size: 1000,
      width: 100,
      height: 100,
    });
    expect(await s.run()).toMatchObject({ status: 'pending' });
    expect(s.assets.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: id, assetId: 'logo-owned' }),
    );
    expect(s.emoji.generate).not.toHaveBeenCalled();
  });
  it('runs the real graph, owner-scoped tools, strict patch and original validator without rendering', async () => {
    const s = setup();
    const result = await s.run();
    expect(result).toMatchObject({
      status: 'pending',
      calls: 2,
      toolCalls: 4,
      patch: { baseRevision: 1 },
    });
    expect(s.plan.plan.operations).toEqual([]);
    expect(s.onStage.mock.calls.map(([stage]) => stage)).toEqual([
      'load_context',
      'interpret',
      'resolve_information',
      'resolve_assets',
      'generate_patch',
      'validate',
    ]);
    expect(s.plans.findOne).toHaveBeenCalledWith({
      _id: id,
      userId: id,
      sourceClipId: clipId,
    });
    expect(s.registry.recordUsage).toHaveBeenCalledTimes(2);
    expect(s.registry.recordUsage.mock.calls[0][0]).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostUsd: 0.00014,
    });
    expect(JSON.stringify(s.onTool.mock.calls)).not.toContain('not-in-tools');
    expect(JSON.stringify(s.onTool.mock.calls)).not.toContain('private-key');
  });
  it('searches coarse transcript timestamps with output mappings', async () => {
    const s = setup([{ ...intent, phrases: ['Hello world'] }, answer]);
    await s.run();
    const result = s.onTool.mock.calls.find(
      (c) => c[0] === 'search_transcript',
    )?.[1] as {
      matches: {
        sourceStart: number;
        sourceEnd: number;
        outputCandidates: { start: number; end: number }[];
      }[];
    };
    expect(result.matches[0]).toMatchObject({
      sourceStart: 0,
      sourceEnd: 1,
      outputCandidates: [{ start: 0, end: 1 }],
    });
  });
  it('forces clarification when a transcript phrase is absent', async () => {
    const s = setup([{ ...intent, phrases: ['a nonexistent phrase'] }]);
    const result = await s.run();
    expect(result.status).toBe('clarification');
    expect(s.google.structured).toHaveBeenCalledTimes(1);
    expect(result.patch).toBeUndefined();
  });
  it('corrects invalid output timestamps once and stops at three model calls', async () => {
    const s = setup([
      intent,
      {
        ...answer,
        patchJson: JSON.stringify({
          ...patch,
          changes: [
            {
              ...patch.changes[0],
              operation: { ...patch.changes[0].operation, end: 20 },
            },
          ],
        }),
      },
      answer,
    ]);
    expect((await s.run()).calls).toBe(3);
    expect(s.google.structured).toHaveBeenCalledTimes(3);
  });
  it('rejects malformed patch JSON after one bounded correction', async () => {
    const s = setup([
      intent,
      { ...answer, patchJson: 'invalid' },
      { ...answer, patchJson: 'invalid' },
    ]);
    await expect(s.run()).rejects.toBeInstanceOf(BadRequestException);
    expect(s.google.structured).toHaveBeenCalledTimes(3);
  });
  it('returns unsupported effects without generating executable parameters', async () => {
    const s = setup([
      { ...intent, unsupported: 'Face tracking is not supported' },
      {
        outcome: 'unsupported',
        summary: 'Face tracking is not supported',
        patchJson: '',
        unavailableCapabilities: ['face_tracking'],
      },
    ]);
    expect(await s.run()).toMatchObject({
      status: 'unsupported',
      calls: 2,
      patch: undefined,
    });
  });
  it('asks for missing music assets instead of creating an asset reference', async () => {
    const s = setup([
      {
        ...intent,
        clarification:
          'Upload approved music first; this patch version cannot change audio tracks',
        assets: [{ kind: 'audio', query: 'approved music' }],
      },
    ]);
    expect(await s.run()).toMatchObject({
      status: 'clarification',
      calls: 1,
      patch: undefined,
    });
  });
  it('stops on provider timeout and records a failed request', async () => {
    const s = setup();
    s.google.structured.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'AI_TIMEOUT',
        message: 'AI model request timed out',
        callFailure: {
          code: 'AI_TIMEOUT',
          category: 'timeout',
          origin: 'transport',
          retryable: true,
        },
      }),
    );
    await expect(s.run()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s.google.structured).toHaveBeenCalledTimes(2);
    expect(s.registry.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'AI_TIMEOUT',
      }),
    );
  });
  it('retries only patch generation after a transient response, without replaying asset resolution', async () => {
    const s = setup();
    s.google.structured
      .mockResolvedValueOnce({ parsed: intent })
      .mockRejectedValueOnce(
        new ServiceUnavailableException({
          code: 'AI_PROVIDER_FAILED',
          callFailure: {
            code: 'AI_PROVIDER_FAILED',
            category: 'provider',
            origin: 'provider_http',
            upstreamStatus: 503,
            retryable: true,
          },
        }),
      )
      .mockResolvedValueOnce({ parsed: answer });
    expect(await s.run()).toMatchObject({ status: 'pending', calls: 3 });
    expect(
      s.onStage.mock.calls.filter(([stage]) => stage === 'resolve_assets'),
    ).toHaveLength(1);
    expect(
      s.onStage.mock.calls.filter(([stage]) => stage === 'generate_patch'),
    ).toHaveLength(1);
    expect(s.google.structured).toHaveBeenCalledTimes(3);
  });
  it('stops before a model call when the execution deadline is exhausted', async () => {
    const s = setup();
    await expect(
      s.run('Add a zoom', { deadlineAt: Date.now() - 1 }),
    ).rejects.toMatchObject({ response: { code: 'AI_TIMEOUT' } });
    expect(s.google.structured).not.toHaveBeenCalled();
  });
  it('cancels retry backoff without another paid request', async () => {
    const s = setup();
    const controller = new AbortController();
    s.google.structured.mockImplementation(async () => {
      setTimeout(() => controller.abort(), 30);
      throw new ServiceUnavailableException({
        code: 'AI_TIMEOUT',
        callFailure: {
          code: 'AI_TIMEOUT',
          category: 'timeout',
          origin: 'transport',
          retryable: true,
        },
      });
    });
    await expect(
      s.run('Add a zoom', { signal: controller.signal }),
    ).rejects.toThrow();
    expect(s.google.structured).toHaveBeenCalledTimes(1);
  });
  it('does not retry database/tool failures through another paid model call', async () => {
    const s = setup();
    s.plans.findOne.mockImplementation(() => ({
      maxTimeMS: jest.fn().mockRejectedValue(new Error('database unavailable')),
    }));
    await expect(s.run()).rejects.toThrow('database unavailable');
    expect(s.google.structured).not.toHaveBeenCalled();
  });
  it('rejects cross-user clip access independently of prompts', async () => {
    const s = setup();
    s.plans.findOne.mockImplementation(() => query(null));
    await expect(s.tools.owned('other', clipId, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(s.plans.findOne).toHaveBeenCalledWith({
      _id: id,
      userId: 'other',
      sourceClipId: clipId,
    });
    expect(s.google.structured).not.toHaveBeenCalled();
  });
  it('rejects stale plans rather than paying for a corrective guess', async () => {
    const s = setup();
    s.google.structured.mockImplementation(() => {
      if (s.google.structured.mock.calls.length === 2) s.plan.revision = 2;
      return Promise.resolve({
        parsed: s.google.structured.mock.calls.length === 1 ? intent : answer,
        usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      });
    });
    await expect(s.run()).rejects.toBeInstanceOf(ConflictException);
    expect(s.google.structured).toHaveBeenCalledTimes(2);
  });
  it('prevents empty or malformed structured envelopes from being persisted', async () => {
    const s = setup([{}]);
    await expect(s.run()).rejects.toBeInstanceOf(BadRequestException);
    expect(s.google.structured).toHaveBeenCalledTimes(1);
  });
});

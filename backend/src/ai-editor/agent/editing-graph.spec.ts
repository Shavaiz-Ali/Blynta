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
function setup(outputs: unknown[] = [intent, answer]) {
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
      lean: jest.fn().mockResolvedValue([]),
    })),
  };
  const validator = new EditPlanValidatorService(
    assets as unknown as Model<StudioAsset>,
    {} as R2Service,
  );
  const tools = new AgentTools(
    plans as unknown as Model<StoredEditPlan>,
    jobs as unknown as Model<Job>,
    assets as unknown as Model<StudioAsset>,
    validator,
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
    google as unknown as GoogleAdapter,
  );
  const onTool = jest.fn((_name: string, _result: unknown) => {
    void _name;
    void _result;
    return Promise.resolve();
  });
  const run = () =>
    graph.run({
      userId: id,
      clipId,
      planId: id,
      prompt: 'Add a zoom',
      history: [],
      executionId: 'execution',
      signal: AbortSignal.timeout(10000),
      onTool,
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
  };
}
describe('Bounded LangGraph proposal integration', () => {
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
    ]);
    expect(await s.run()).toMatchObject({
      status: 'unsupported',
      calls: 1,
      patch: undefined,
    });
  });
  it('asks for missing music assets instead of creating an asset reference', async () => {
    const s = setup([
      {
        ...intent,
        clarification:
          'Upload approved music first; this patch version cannot change audio tracks',
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
      new ServiceUnavailableException('AI provider request failed'),
    );
    await expect(s.run()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s.google.structured).toHaveBeenCalledTimes(1);
    expect(s.registry.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'AI_REQUEST_FAILED',
      }),
    );
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

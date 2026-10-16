import { AGENT_LIMITS } from './agent.constants';
import { AI_ERROR_CODES, AI_EDIT_STAGE_LABEL } from '@blynta/types/contracts';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { ModelRegistry } from '../../ai-registry/model-registry.service';
import { objectId, parseEdit } from '../edit-plan.contract';
import { EditPlansService } from '../edit-plans.service';
import type { StoredEditPlan } from '../edit.schemas';
import type { AgentMessage, AgentSession, EditProposal } from './agent.schemas';
import { AgentTools } from './agent-tools.service';
import { EditingGraph } from './editing-graph.service';
import { mergeEditPatch } from './edit-patch';
import { readBuildInfo } from '../../common/build-info';
import { callFailure } from '../../ai-registry/call-diagnostics';
const proposeInput = z
  .object({
    planId: objectId,
    sessionId: objectId.optional(),
    modelId: objectId.optional(),
    selectedAssetIds: z
      .array(
        z
          .string()
          .min(1)
          .max(80)
          .regex(/^[\w-]+$/),
      )
      .max(8)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Duplicate attachment IDs',
      )
      .optional(),
    prompt: z.string().trim().min(1).max(4000),
    requestId: z.string().uuid(),
  })
  .strict();
@Injectable()
export class ProposalsService {
  constructor(
    @InjectModel('AIAgentSession') private sessions: Model<AgentSession>,
    @InjectModel('AIAgentMessage') private messages: Model<AgentMessage>,
    @InjectModel('AIEditProposal') private proposals: Model<EditProposal>,
    @InjectModel('EditPlan') private plans: Model<StoredEditPlan>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
    private registry: ModelRegistry,
    private tools: AgentTools,
    private graph: EditingGraph,
    private editing: EditPlansService,
  ) {}
  async propose(userId: string, clipId: string, body: unknown) {
    parseEdit(objectId, clipId);
    const input = parseEdit(proposeInput, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, clipId }))
      .digest('hex');
    const existing = await this.proposals.findOne({
      userId,
      requestId: input.requestId,
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException(
          'Request ID was used for a different proposal',
        );
      return existing;
    }
    const owned = await this.tools.owned(userId, clipId, input.planId);
    if (input.selectedAssetIds?.length)
      await this.tools.selectedAssets(
        userId,
        clipId,
        input.planId,
        input.selectedAssetIds,
      );
    const resolved = await this.registry.resolveUserModel(
      userId,
      input.modelId,
      input.sessionId ? 'edit_refinement' : 'edit_planning',
    );
    const session = input.sessionId
      ? await this.sessions.findOne({
          _id: input.sessionId,
          userId,
          clipId,
          planId: input.planId,
          status: 'active',
        })
      : await this.sessions.create({
          userId,
          clipId,
          planId: input.planId,
          status: 'active',
          title: input.prompt.slice(0, 100),
        });
    if (!session) throw new NotFoundException('Editing session not found');
    let proposal: HydratedDocument<EditProposal>;
    try {
      proposal = await this.proposals.create({
        userId,
        clipId,
        planId: input.planId,
        sessionId: String(session._id),
        requestId: input.requestId,
        fingerprint,
        executionId: randomUUID(),
        baseRevision: owned.plan.revision,
        beforePlan: owned.plan.plan,
        status: 'generating',
        executionBuild: readBuildInfo(),
        summary: 'Generating a proposal',
        modelId: String(resolved.model._id),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const prior = await this.proposals.findOne({
          userId,
          requestId: input.requestId,
        });
        if (prior?.fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID was used for a different proposal',
          );
        return prior;
      }
      throw error;
    }
    let lastStage = 'load_context';
    const abort = new AbortController();
    let checking = false;
    const cancelPoll = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.redis
        .get(`ai:cancel:${userId}:${proposal.executionId}`)
        .then((cancelled) => {
          if (cancelled) abort.abort();
        })
        .catch(() => abort.abort())
        .finally(() => {
          checking = false;
        });
    }, 1000);
    try {
      const configured = Number(
        this.config.get(
          'AI_AGENT_DAILY_REQUEST_LIMIT',
          AGENT_LIMITS.DAILY_REQUESTS,
        ),
      );
      if (!Number.isInteger(configured) || configured < 1 || configured > 10000)
        throw new BadRequestException('Invalid AI usage budget configuration');
      const budget = Number(
        await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],86400) end; return n",
          1,
          'ai:daily:' + userId + ':' + new Date().toISOString().slice(0, 10),
        ),
      );
      if (budget > configured)
        throw new HttpException(
          'Daily AI proposal request budget exceeded',
          429,
        );
      const history = await this.messages
        .find({
          userId,
          sessionId: String(session._id),
          role: { $in: ['user', 'assistant'] },
        })
        .sort({ createdAt: -1, _id: -1 })
        .limit(8)
        .select('role content -_id')
        .lean();
      const priorEdits = await this.proposals
        .find({ userId, sessionId: String(session._id), status: 'applied' })
        .sort({ createdAt: -1, _id: -1 })
        .limit(2)
        .select('patch beforePlan appliedRevision -_id')
        .lean();
      await this.messages.create({
        userId,
        sessionId: String(session._id),
        role: 'user',
        content: input.prompt,
        modelId: proposal.modelId,
        executionId: proposal.executionId,
      });
      const result = await this.graph.run({
        userId,
        clipId,
        planId: input.planId,
        prompt: input.prompt,
        selectedAssetIds: input.selectedAssetIds,
        modelId: input.modelId,
        task: input.sessionId ? 'edit_refinement' : 'edit_planning',
        executionId: proposal.executionId,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(90000)]),
        priorEdits,
        history: history
          .reverse()
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
        onTool: async (name, result) => {
          await this.messages.create({
            userId,
            sessionId: String(session._id),
            role: 'tool',
            content: JSON.stringify({ name, result }).slice(0, 4000),
            executionId: proposal.executionId,
          });
        },
        onStage: async (stage) => {
          if (!AI_EDIT_STAGE_LABEL[stage]) return;
          lastStage = stage;
          await this.redis.set(
            `ai:stage:${userId}:${proposal.executionId}`,
            stage,
            'EX',
            300,
          );
        },
        onDiagnostic: async (event) => {
          await this.proposals.updateOne(
            { _id: proposal._id, status: 'generating' },
            { $push: { diagnostics: { $each: [event], $slice: -64 } } },
          );
        },
      });
      if (result.patch && result.patch.baseRevision !== proposal.baseRevision)
        throw new ConflictException(
          'Plan revision changed during proposal generation',
        );
      const saved = await this.proposals.findOneAndUpdate(
        { _id: proposal._id, status: 'generating' },
        { $set: { ...result } },
        { new: true },
      );
      if (!saved) return this.get(userId, clipId, String(proposal._id));
      await this.messages.create({
        userId,
        sessionId: String(session._id),
        role: 'assistant',
        content: result.summary,
        proposalId: String(proposal._id),
        modelId: result.modelId,
        executionId: proposal.executionId,
      });
      await this.sessions.updateOne(
        { _id: session._id, userId },
        {
          $set: {
            selectedModelId: input.modelId || 'auto',
            ...(session.title === 'New conversation' || !session.title
              ? { title: input.prompt.slice(0, 100) }
              : {}),
          },
        },
      );
      return saved;
    } catch (error) {
      const current = await this.proposals.findOne({
        _id: proposal._id,
        userId,
        status: 'cancelled',
      });
      if (current) return current;
      const failure = callFailure(error, abort.signal.aborted);
      await this.proposals.updateOne(
        { _id: proposal._id, status: 'generating' },
        {
          $set: {
            status: 'failed',
            summary:
              'AI proposal could not be generated; retry with a new request ID',
            errorCode:
              error instanceof HttpException &&
              typeof error.getResponse() === 'object' &&
              [
                'AI_UNVERIFIED_UNSUPPORTED',
                'AI_PATCH_INVALID',
                'AI_STRUCTURED_OUTPUT_INVALID',
              ].includes(
                String((error.getResponse() as { code?: unknown }).code),
              )
                ? (error.getResponse() as { code: string }).code
                : failure.code,
            failedStage: lastStage,
            retryable: failure.retryable,
          },
        },
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('AI proposal could not be generated');
    } finally {
      clearInterval(cancelPoll);
    }
  }
  async cancel(userId: string, clipId: string, id: string) {
    const prior = await this.get(userId, clipId, id);
    if (prior.status === 'cancelled') return prior;
    const cancelled = await this.proposals.findOneAndUpdate(
      { _id: id, userId, clipId, status: 'generating' },
      {
        $set: {
          status: 'cancelled',
          summary: 'Suggestion canceled',
          retryable: false,
        },
      },
      { new: true },
    );
    if (!cancelled)
      throw new ConflictException(
        'Only a generating suggestion can be canceled',
      );
    await this.redis.set(
      `ai:cancel:${userId}:${prior.executionId}`,
      '1',
      'EX',
      300,
    );
    return cancelled;
  }
  async state(
    userId: string,
    clipId: string,
    planId: string,
  ): Promise<{ session: object | null; proposals: object[] }> {
    parseEdit(objectId, planId);
    await this.tools.owned(userId, clipId, planId);
    const session = await this.sessions
      .findOne({ userId, clipId, planId, status: 'active' })
      .sort({ updatedAt: -1, _id: -1 })
      .lean();
    const proposals = await this.proposals
      .find({ userId, clipId, planId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .select('-beforePlan -fingerprint')
      .lean();
    const interrupted = proposals.filter(
      (p) =>
        p.status === 'generating' &&
        p.createdAt &&
        Date.now() - p.createdAt.getTime() > 300000,
    );
    if (interrupted.length) {
      await this.proposals.updateMany(
        {
          _id: { $in: interrupted.map((p) => p._id) },
          userId,
          status: 'generating',
        },
        {
          $set: {
            status: 'failed',
            errorCode: AI_ERROR_CODES.EXECUTION_INTERRUPTED,
            summary: 'Generation was interrupted; submit a new request ID',
          },
        },
      );
      return this.state(userId, clipId, planId);
    }
    const visible = await Promise.all(
      proposals.reverse().map(async (p) => ({
        ...p,
        stage:
          p.status === 'generating'
            ? await this.redis.get(`ai:stage:${userId}:${p.executionId}`)
            : undefined,
      })),
    );
    return { session, proposals: visible };
  }
  async get(userId: string, clipId: string, id: string) {
    parseEdit(objectId, clipId);
    parseEdit(objectId, id);
    const proposal = await this.proposals.findOne({ _id: id, userId, clipId });
    if (!proposal) throw new NotFoundException('Proposal not found');
    await this.tools.owned(userId, clipId, proposal.planId);
    if (
      proposal.status === 'generating' &&
      proposal.createdAt &&
      Date.now() - proposal.createdAt.getTime() > 300000
    ) {
      await this.proposals.updateOne(
        { _id: id, userId, status: 'generating' },
        {
          $set: {
            status: 'failed',
            errorCode: AI_ERROR_CODES.EXECUTION_INTERRUPTED,
            summary: 'Generation was interrupted; submit a new request ID',
          },
        },
      );
      proposal.status = 'failed';
      proposal.errorCode = AI_ERROR_CODES.EXECUTION_INTERRUPTED;
    }
    return proposal;
  }
  async apply(userId: string, clipId: string, id: string) {
    const proposal = await this.get(userId, clipId, id);
    if (
      !['pending', 'applying', 'applied'].includes(proposal.status) ||
      !proposal.patch
    )
      throw new ConflictException('Proposal is not available to apply');
    const current = await this.plans.findOne({
      _id: proposal.planId,
      userId,
      sourceClipId: clipId,
    });
    if (!current) throw new NotFoundException('Edit plan not found');
    if (proposal.status === 'applied' || current.lastAppliedProposalId === id) {
      await this.proposals.updateOne(
        { _id: id, userId },
        {
          $set: {
            status: 'applied',
            appliedRevision: proposal.noChanges
              ? proposal.baseRevision
              : proposal.baseRevision + 1,
          },
        },
      );
      return {
        ...(await this.editing.get(userId, proposal.planId)),
        noChanges: !!proposal.noChanges,
      };
    }
    let merged: ReturnType<typeof mergeEditPatch>;
    try {
      merged = mergeEditPatch(current.plan, current.revision, proposal.patch);
    } catch (error) {
      if (proposal.status === 'applying')
        await this.proposals.updateOne(
          { _id: id, userId, status: 'applying' },
          { $set: { status: 'pending' } },
        );
      throw error;
    }
    if (isDeepStrictEqual(merged.plan, current.plan)) {
      const marked = await this.proposals.updateOne(
        { _id: id, userId, status: { $in: ['pending', 'applying'] } },
        {
          $set: {
            status: 'applied',
            appliedRevision: proposal.baseRevision,
            noChanges: true,
            summary: 'No changes needed; these edits are already saved.',
          },
        },
      );
      if (marked.modifiedCount === 0)
        throw new ConflictException(
          'Proposal state changed; refresh before applying',
        );
      return {
        ...(await this.editing.get(userId, proposal.planId)),
        noChanges: true,
      };
    }
    if (proposal.status === 'pending') {
      const claimed = await this.proposals.findOneAndUpdate(
        { _id: id, userId, status: 'pending' },
        { $set: { status: 'applying' } },
        { new: true },
      );
      if (!claimed)
        throw new ConflictException(
          'Proposal state changed; reload before applying',
        );
    }
    let result: Record<string, unknown>;
    try {
      result = await this.editing.update(
        userId,
        proposal.planId,
        { revision: proposal.baseRevision, plan: merged.plan },
        id,
      );
    } catch (error) {
      const durable = await this.plans.findOne({
        _id: proposal.planId,
        userId,
        lastAppliedProposalId: id,
      });
      if (!durable) {
        await this.proposals.updateOne(
          { _id: id, userId, status: 'applying' },
          { $set: { status: 'pending' } },
        );
        throw error;
      }
      result = await this.editing.get(userId, proposal.planId);
    }
    await this.proposals.updateOne(
      { _id: id, userId, status: { $in: ['pending', 'applying'] } },
      {
        $set: { status: 'applied', appliedRevision: proposal.baseRevision + 1 },
      },
    );
    return result;
  }
  async reject(userId: string, clipId: string, id: string) {
    const proposal = await this.get(userId, clipId, id);
    if (proposal.status === 'rejected') return proposal;
    if (proposal.status !== 'pending')
      throw new ConflictException('Only pending proposals can be rejected');
    const current = await this.plans.findOne({ _id: proposal.planId, userId });
    if (current?.lastAppliedProposalId === id)
      throw new ConflictException('Proposal has already been applied');
    const updated = await this.proposals.findOneAndUpdate(
      { _id: id, userId, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Proposal state changed; refresh before continuing',
      );
    return updated;
  }
  async history(
    userId: string,
    clipId: string,
    sessionId: string,
    before?: string,
  ) {
    parseEdit(objectId, clipId);
    parseEdit(objectId, sessionId);
    if (before) parseEdit(objectId, before);
    const session = await this.sessions.findOne({
      _id: sessionId,
      userId,
      clipId,
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.tools.owned(userId, clipId, session.planId);
    const messages = await this.messages
      .find({
        userId,
        sessionId,
        role: { $in: ['user', 'assistant'] },
        ...(before ? { _id: { $lt: before } } : {}),
      })
      .sort({ _id: -1 })
      .limit(51)
      .lean();
    const hasMore = messages.length > 50;
    const page = messages.slice(0, 50);
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;
    const proposals = await this.proposals
      .find({
        userId,
        clipId,
        sessionId,
        planId: session.planId,
        ...(before
          ? {
              _id: {
                $in: page.flatMap((m) => (m.proposalId ? [m.proposalId] : [])),
              },
            }
          : {}),
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .select('-beforePlan -fingerprint')
      .lean();
    return {
      session,
      messages: page.reverse(),
      proposals: proposals.reverse(),
      nextCursor,
    };
  }

  async listSessions(userId: string, clipId: string, planId: string) {
    parseEdit(objectId, planId);
    await this.tools.owned(userId, clipId, planId);
    const items = await this.sessions
      .find({ userId, clipId, planId, status: 'active' })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(200)
      .lean();
    return { items };
  }

  async createSession(userId: string, clipId: string, body: unknown) {
    const input = parseEdit(
      z
        .object({
          planId: objectId,
          title: z.string().trim().min(1).max(100).optional(),
          requestId: z.string().uuid(),
          resumeLatest: z.boolean().optional(),
        })
        .strict(),
      body,
    );
    await this.tools.owned(userId, clipId, input.planId);
    if (input.resumeLatest) {
      const latest = await this.sessions
        .findOne({ userId, clipId, planId: input.planId, status: 'active' })
        .sort({ updatedAt: -1, _id: -1 });
      if (latest) return latest;
    }
    const identity = {
      userId,
      clipId,
      planId: input.planId,
      requestId: input.requestId,
    };
    try {
      return await this.sessions.findOneAndUpdate(
        identity,
        {
          $setOnInsert: {
            planId: input.planId,
            requestId: input.requestId,
            userId,
            clipId,
            status: 'active',
            title: input.title || 'New conversation',
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await this.sessions.findOne(identity);
      if (existing) return existing;
      throw new ConflictException(
        'Session request ID belongs to a different clip or plan',
      );
    }
  }

  async updateSession(
    userId: string,
    clipId: string,
    sessionId: string,
    body: unknown,
  ) {
    parseEdit(objectId, sessionId);
    const input = parseEdit(
      z
        .object({
          title: z.string().trim().min(1).max(100).optional(),
          status: z.enum(['active', 'archived']).optional(),
        })
        .strict()
        .refine((v) => Object.keys(v).length > 0),
      body,
    );
    const session = await this.sessions.findOne({
      _id: sessionId,
      userId,
      clipId,
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.tools.owned(userId, clipId, session.planId);
    return this.sessions.findOneAndUpdate(
      { _id: sessionId, userId, clipId },
      { $set: input },
      { new: true },
    );
  }
}

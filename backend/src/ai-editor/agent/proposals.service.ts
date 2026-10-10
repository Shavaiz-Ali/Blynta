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
const proposeInput = z
  .object({
    planId: objectId,
    sessionId: objectId.optional(),
    modelId: objectId.optional(),
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
    try {
      const configured = Number(
        this.config.get('AI_AGENT_DAILY_REQUEST_LIMIT', 50),
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
        modelId: input.modelId,
        task: input.sessionId ? 'edit_refinement' : 'edit_planning',
        executionId: proposal.executionId,
        signal: AbortSignal.timeout(90000),
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
        { $set: { selectedModelId: result.modelId } },
      );
      return saved;
    } catch (error) {
      await this.proposals.updateOne(
        { _id: proposal._id, status: 'generating' },
        {
          $set: {
            status: 'failed',
            summary:
              'AI proposal could not be generated; retry with a new request ID',
            errorCode: 'AI_PROPOSAL_FAILED',
          },
        },
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('AI proposal could not be generated');
    }
  }
  async state(
    userId: string,
    clipId: string,
    planId: string,
  ): Promise<{ session: object | null; proposals: object[] }> {
    parseEdit(objectId, planId);
    await this.tools.owned(userId, clipId, planId);
    const session = await this.sessions
      .findOne({ userId, clipId, planId })
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
            errorCode: 'AI_EXECUTION_INTERRUPTED',
            summary: 'Generation was interrupted; submit a new request ID',
          },
        },
      );
      return this.state(userId, clipId, planId);
    }
    return { session, proposals: proposals.reverse() };
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
            errorCode: 'AI_EXECUTION_INTERRUPTED',
            summary: 'Generation was interrupted; submit a new request ID',
          },
        },
      );
      proposal.status = 'failed';
      proposal.errorCode = 'AI_EXECUTION_INTERRUPTED';
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
            appliedRevision: proposal.baseRevision + 1,
          },
        },
      );
      return this.editing.get(userId, proposal.planId);
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
  async history(userId: string, clipId: string, sessionId: string) {
    parseEdit(objectId, clipId);
    parseEdit(objectId, sessionId);
    const session = await this.sessions.findOne({
      _id: sessionId,
      userId,
      clipId,
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.tools.owned(userId, clipId, session.planId);
    const messages = await this.messages
      .find({ userId, sessionId, role: { $in: ['user', 'assistant'] } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean();
    return { session, messages: messages.reverse() };
  }
}

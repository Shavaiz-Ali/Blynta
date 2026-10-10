import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProposalsService } from './proposals.service';
import { examplePlan } from '../edit-plan.fixture';
import { createHash } from 'node:crypto';
const id = '111111111111111111111111',
  clipId = '222222222222222222222222',
  planId = '333333333333333333333333';
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
function setup() {
  const proposal = {
    _id: id,
    userId: id,
    clipId,
    planId,
    baseRevision: 1,
    status: 'pending',
    patch,
  };
  const current = {
    plan: examplePlan(),
    revision: 1,
    lastAppliedProposalId: undefined as string | undefined,
  };
  const proposals = {
    findOne: jest.fn().mockResolvedValue(proposal),
    updateOne: jest.fn().mockResolvedValue({}),
    findOneAndUpdate: jest.fn().mockResolvedValue(proposal),
  };
  const plans = { findOne: jest.fn().mockResolvedValue(current) };
  const editing = {
    update: jest.fn().mockResolvedValue({ id: planId, revision: 2 }),
    get: jest.fn().mockResolvedValue({ id: planId, revision: 2 }),
  };
  const tools = { owned: jest.fn().mockResolvedValue({ plan: current }) };
  const service = new ProposalsService(
    ...([
      {},
      {},
      proposals,
      plans,
      {},
      new ConfigService(),
      {},
      tools,
      {},
      editing,
    ] as unknown as ConstructorParameters<typeof ProposalsService>),
  );
  return { service, proposal, current, proposals, plans, editing, tools };
}
describe('Proposal approval delegates to existing optimistic updates', () => {
  it('claims pending approval before the plan write so rejection cannot race approval', async () => {
    const s = setup();
    s.proposals.findOneAndUpdate.mockResolvedValue(null);
    await expect(s.service.apply(id, clipId, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.editing.update).not.toHaveBeenCalled();
    expect(s.proposals.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, userId: id, status: 'pending' },
      { $set: { status: 'applying' } },
      { new: true },
    );
  });
  it('rejects only owned pending proposals and blocks rejection during approval', async () => {
    const s = setup();
    expect(await s.service.reject(id, clipId, id)).toBe(s.proposal);
    expect(s.proposals.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, userId: id, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true },
    );
    s.proposal.status = 'applying';
    await expect(s.service.reject(id, clipId, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('returns a repeated request without another provider call and rejects changed reuse', async () => {
    const body = {
      planId,
      prompt: 'Add a zoom',
      requestId: '11111111-1111-4111-8111-111111111111',
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...body, clipId }))
      .digest('hex');
    const existing = { fingerprint, status: 'pending', userId: id };
    const proposals = { findOne: jest.fn().mockResolvedValue(existing) };
    const graph = { run: jest.fn() };
    const tools = { owned: jest.fn() };
    const service = new ProposalsService(
      ...([
        {},
        {},
        proposals,
        {},
        {},
        new ConfigService(),
        {},
        tools,
        graph,
        {},
      ] as unknown as ConstructorParameters<typeof ProposalsService>),
    );
    expect(await service.propose(id, clipId, body)).toBe(existing);
    expect(graph.run).not.toHaveBeenCalled();
    expect(tools.owned).not.toHaveBeenCalled();
    await expect(
      service.propose(id, clipId, { ...body, prompt: 'Different request' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('merges, revalidates through Phase 1 update and never invokes rendering', async () => {
    const s = setup();
    expect(await s.service.apply(id, clipId, id)).toEqual({
      id: planId,
      revision: 2,
    });
    expect(s.editing.update).toHaveBeenCalledWith(
      id,
      planId,
      {
        revision: 1,
        plan: expect.objectContaining({
          operations: [expect.objectContaining({ id: 'zoom', source: 'ai' })],
        }) as unknown,
      },
      id,
    );
    expect(s.proposals.updateOne).toHaveBeenCalledWith(
      { _id: id, userId: id, status: { $in: ['pending', 'applying'] } },
      { $set: { status: 'applied', appliedRevision: 2 } },
    );
  });
  it('refuses stale revisions without updating a plan', async () => {
    const s = setup();
    s.current.revision = 2;
    await expect(s.service.apply(id, clipId, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.editing.update).not.toHaveBeenCalled();
    s.proposal.status = 'applying';
    await expect(s.service.apply(id, clipId, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.proposals.updateOne).toHaveBeenCalledWith(
      { _id: id, userId: id, status: 'applying' },
      { $set: { status: 'pending' } },
    );
  });
  it('repairs a lost response using the durable proposal marker without applying twice', async () => {
    const s = setup();
    s.current.lastAppliedProposalId = id;
    s.current.revision = 2;
    await s.service.apply(id, clipId, id);
    expect(s.editing.update).not.toHaveBeenCalled();
    expect(s.editing.get).toHaveBeenCalledWith(id, planId);
  });
  it('rejects non-approvable or cross-user proposals', async () => {
    const s = setup();
    s.proposal.status = 'clarification';
    await expect(s.service.apply(id, clipId, id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    s.proposals.findOne.mockResolvedValue(null);
    await expect(s.service.get('other', clipId, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(s.proposals.findOne).toHaveBeenLastCalledWith({
      _id: id,
      userId: 'other',
      clipId,
    });
  });
  it('does not read another user session history', async () => {
    const sessions = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new ProposalsService(
      ...([
        sessions,
        {},
        {},
        {},
        {},
        new ConfigService(),
        {},
        {},
        {},
        {},
      ] as unknown as ConstructorParameters<typeof ProposalsService>),
    );
    await expect(service.history(id, clipId, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessions.findOne).toHaveBeenCalledWith({
      _id: id,
      userId: id,
      clipId,
    });
  });
});

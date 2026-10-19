import { ProposalsService } from './proposals.service';
const owner = '111111111111111111111111',
  clip = '222222222222222222222222',
  plan = '333333333333333333333333',
  sessionId = '444444444444444444444444';
function setup() {
  const session = { _id: sessionId, userId: owner, clipId: clip, planId: plan };
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([session]),
  };
  const sessions = {
    find: jest.fn().mockReturnValue(query),
    findOne: jest.fn().mockResolvedValue(session),
    findOneAndUpdate: jest.fn().mockResolvedValue(session),
  };
  const tools = { owned: jest.fn().mockResolvedValue({}) };
  const service = new ProposalsService(
    ...([
      sessions,
      {},
      {},
      {},
      {},
      {},
      {},
      tools,
      {},
      {},
    ] as unknown as ConstructorParameters<typeof ProposalsService>),
  );
  return { service, sessions, tools, session };
}
describe('Studio conversations share plans safely', () => {
  it('pages older messages within the owned session and includes their linked proposals', async () => {
    const makeId = (n: number) => String(n).padStart(24, '0');
    const records = Array.from({ length: 51 }, (_, i) => ({
      _id: makeId(100 - i),
      role: 'user',
      proposalId: sessionId,
    }));
    const messagesQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(records),
    };
    const messages = { find: jest.fn().mockReturnValue(messagesQuery) };
    const proposalsQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const proposals = { find: jest.fn().mockReturnValue(proposalsQuery) };
    const sessions = { findOne: jest.fn().mockResolvedValue({ planId: plan }) };
    const tools = { owned: jest.fn().mockResolvedValue({}) };
    const service = new ProposalsService(
      ...([
        sessions,
        messages,
        proposals,
        {},
        {},
        {},
        {},
        tools,
        {},
        {},
      ] as unknown as ConstructorParameters<typeof ProposalsService>),
    );
    const result = await service.history(owner, clip, sessionId, makeId(101));
    expect(result.messages).toHaveLength(50);
    expect(result.nextCursor).toBe(makeId(51));
    expect(result.messages[0]._id).toBe(makeId(51));
    expect(messages.find).toHaveBeenCalledWith({
      userId: owner,
      sessionId,
      role: { $in: ['user', 'assistant'] },
      _id: { $lt: makeId(101) },
    });
    expect(proposals.find).toHaveBeenCalledWith({
      userId: owner,
      clipId: clip,
      sessionId,
      planId: plan,
      _id: { $in: Array(50).fill(sessionId) as string[] },
    });
  });
  it('lists only active sessions belonging to the owned clip and plan', async () => {
    const s = setup();
    await s.service.listSessions(owner, clip, plan);
    expect(s.tools.owned).toHaveBeenCalledWith(owner, clip, plan);
    expect(s.sessions.find).toHaveBeenCalledWith({
      userId: owner,
      clipId: clip,
      planId: plan,
      status: 'active',
    });
  });
  it('creates a session with a stable retry identity and never creates a plan', async () => {
    const s = setup();
    const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await s.service.createSession(owner, clip, { planId: plan, requestId });
    expect(s.sessions.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: owner, clipId: clip, planId: plan, requestId },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          title: 'New conversation',
          status: 'active',
        }) as unknown,
      }),
      { upsert: true, returnDocument: 'after' },
    );
    s.sessions.findOneAndUpdate.mockRejectedValueOnce({ code: 11000 });
    expect(
      await s.service.createSession(owner, clip, { planId: plan, requestId }),
    ).toEqual(s.session);
  });
  it('resumes the latest owned active conversation without creating or merging data', async () => {
    const s = setup();
    const sort = jest.fn().mockResolvedValue(s.session);
    s.sessions.findOne.mockReturnValueOnce({ sort });
    expect(
      await s.service.createSession(owner, clip, {
        planId: plan,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        resumeLatest: true,
      }),
    ).toEqual(s.session);
    expect(s.sessions.findOne).toHaveBeenCalledWith({
      userId: owner,
      clipId: clip,
      planId: plan,
      status: 'active',
    });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
    expect(s.tools.owned).toHaveBeenCalledWith(owner, clip, plan);
    expect(s.sessions.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('initializes a retry-safe conversation only when no active conversation exists', async () => {
    const s = setup();
    s.sessions.findOne.mockReturnValueOnce({
      sort: jest.fn().mockResolvedValue(null),
    });
    await s.service.createSession(owner, clip, {
      planId: plan,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      resumeLatest: true,
    });
    expect(s.sessions.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const update = (
      s.sessions.findOneAndUpdate.mock.calls as unknown[][]
    )[0][1] as {
      $setOnInsert: object;
    };
    expect(update.$setOnInsert).not.toHaveProperty('resumeLatest');
  });
  it('archives and restores only the authorized session without removing shared edits or messages', async () => {
    const s = setup();
    await s.service.updateSession(owner, clip, sessionId, {
      status: 'archived',
    });
    expect(s.tools.owned).toHaveBeenCalledWith(owner, clip, plan);
    expect(s.sessions.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: sessionId, userId: owner, clipId: clip },
      { $set: { status: 'archived' } },
      { returnDocument: 'after' },
    );
    await s.service.updateSession(owner, clip, sessionId, { status: 'active' });
    s.sessions.findOne.mockResolvedValueOnce(null);
    await expect(
      s.service.updateSession('other', clip, sessionId, { title: 'Forged' }),
    ).rejects.toThrow('not found');
    expect(s.sessions.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
  it('rejects plan reassignment and invalid names before any mutation', async () => {
    const s = setup();
    await expect(
      s.service.updateSession(owner, clip, sessionId, { planId: plan }),
    ).rejects.toThrow();
    await expect(
      s.service.updateSession(owner, clip, sessionId, { title: ' ' }),
    ).rejects.toThrow();
    expect(s.sessions.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

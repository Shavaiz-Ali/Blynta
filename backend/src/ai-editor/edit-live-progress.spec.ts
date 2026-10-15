import { EditPlansService } from './edit-plans.service';
const id = '111111111111111111111111';
function setup() {
  const version = {
    _id: id,
    userId: 'owner',
    status: 'processing',
    phase: 'encoding',
    progress: 0,
    executionToken: 'private-execution',
    generation: 2,
    attempt: 3,
  };
  const versions = {
    findOne: jest.fn(() => ({ lean: () => Promise.resolve(version) })),
  };
  const tick = {
    phase: 'encoding',
    encodingPercent: 64,
    executionToken: 'private-execution',
    generation: 2,
    attempt: 3,
  };
  const queue = { getJob: jest.fn().mockResolvedValue({ progress: tick }) };
  const service = new EditPlansService(
    ...([
      {},
      versions,
      {},
      queue,
      {},
      {},
      {},
    ] as unknown as ConstructorParameters<typeof EditPlansService>),
  );
  return { version, versions, tick, queue, service };
}
describe('Owner-scoped render progress snapshots', () => {
  it('restores live progress on reconnect without exposing private lease tokens', async () => {
    const s = setup();
    expect(await s.service.getVersion('owner', id)).toMatchObject({
      progress: 64,
      attempt: 3,
      generation: 2,
    });
    expect(
      JSON.stringify(await s.service.getVersion('owner', id)),
    ).not.toContain('private-execution');
    expect(s.versions.findOne).toHaveBeenCalledWith({
      _id: id,
      userId: 'owner',
    });
  });
  it.each(['executionToken', 'generation', 'attempt'])(
    'ignores stale %s ticks',
    async (field) => {
      const s = setup();
      Object.assign(s.tick, {
        [field]: field === 'executionToken' ? 'old' : 1,
      });
      expect(await s.service.getVersion('owner', id)).toMatchObject({
        progress: 0,
      });
    },
  );
  it('ignores Redis ticks after cancellation', async () => {
    const s = setup();
    s.version.status = 'cancelled';
    expect(await s.service.getVersion('owner', id)).toMatchObject({
      status: 'cancelled',
      progress: 0,
    });
    expect(s.queue.getJob).not.toHaveBeenCalled();
  });
});

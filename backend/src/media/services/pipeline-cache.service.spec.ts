import { cacheFixture } from '../../../test/pipeline-cache.fixture';
import {
  artifactHash,
  highlightIdentity,
  normalizeInstructions,
} from '../pipeline-cache-identity';

describe('versioned pipeline artifacts and distributed single-flight', () => {
  const identity = {
    source: 'youtube:video:sha',
    transcript: 'transcript-sha',
    preset: 'meme',
    presetInstructions: 'Funny moments',
    owner: 'owner',
    template: 'template-v3',
    configuration: { model: 'model', score: 0.7 },
  };
  const options = () => ({
    key: artifactHash(identity),
    kind: 'highlights' as const,
    sourceVersion: 'sha',
    jobId: 'job',
    validate: (payload: unknown): payload is number[] =>
      Array.isArray(payload) && payload.every((p) => typeof p === 'number'),
    create: jest.fn().mockResolvedValue([1, 2, 3]),
  });
  test('normalizes absent/empty prompts and hashes deterministic effective instructions', () => {
    expect(normalizeInstructions(' \r\n ')).toBe('');
    expect(highlightIdentity(identity)).toBe(
      highlightIdentity({ ...identity, customPrompt: ' \n ' }),
    );
    expect(highlightIdentity({ ...identity, customPrompt: ' Hint\r\n' })).toBe(
      highlightIdentity({ ...identity, customPrompt: 'Hint' }),
    );
    expect(
      highlightIdentity({
        ...identity,
        configuration: { score: 0.7, model: 'model' },
      }),
    ).toBe(highlightIdentity(identity));
    for (const changes of [
      { preset: 'educational' },
      { presetInstructions: 'New instructions' },
      { customPrompt: 'Different hint' },
      { template: 'v4' },
      { version: 'algorithm-v4' },
      { transcript: 'new' },
      { configuration: { model: 'new-model' } },
      { source: 'new-version' },
    ])
      expect(highlightIdentity({ ...identity, ...changes })).not.toBe(
        highlightIdentity(identity),
      );
    expect(
      highlightIdentity({
        ...identity,
        customPrompt: 'private hint',
        owner: 'other',
      }),
    ).not.toBe(
      highlightIdentity({ ...identity, customPrompt: 'private hint' }),
    );
    expect(
      highlightIdentity({ ...identity, customPrompt: 'private hint' }),
    ).toMatch(/^[a-f0-9]{64}$/);
  });
  test('identical instructions reuse an immutable independent payload', async () => {
    const { cache, rows } = cacheFixture();
    const opts = options();
    const first = await cache.getOrCreate(opts);
    first.push(99);
    expect(await cache.getOrCreate(opts)).toEqual([1, 2, 3]);
    expect(opts.create).toHaveBeenCalledTimes(1);
    expect(rows.get(opts.key)!.payload).toEqual([1, 2, 3]);
  });
  test('concurrent requests publish once and waiters reuse the winner', async () => {
    const f = cacheFixture();
    const opts = options();
    let started!: () => void;
    let release!: () => void;
    const beginning = new Promise<void>((resolve) => {
      started = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    opts.create.mockImplementation(async () => {
      started();
      await wait;
      return [1, 2, 3];
    });
    const first = f.cache.getOrCreate(opts);
    await beginning;
    const second = f.cache.getOrCreate(opts);
    release();
    expect(await Promise.all([first, second])).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(opts.create).toHaveBeenCalledTimes(1);
    expect(f.locks.size).toBe(0);
  });
  test('failed generation releases the lock and never publishes a success', async () => {
    const f = cacheFixture();
    const opts = options();
    opts.create.mockRejectedValueOnce(new Error('interrupted'));
    await expect(f.cache.getOrCreate(opts)).rejects.toThrow('interrupted');
    expect(f.rows.size).toBe(0);
    expect(f.locks.size).toBe(0);
    expect(await f.cache.getOrCreate(opts)).toEqual([1, 2, 3]);
  });
  test('lost ownership cannot publish or delete another worker’s lease', async () => {
    const f = cacheFixture();
    const opts = options();
    opts.create.mockImplementation(() => {
      for (const key of f.locks.keys()) f.locks.set(key, 'new-owner');
      return Promise.resolve([1, 2, 3]);
    });
    await expect(f.cache.getOrCreate(opts)).rejects.toThrow('lease lost');
    expect(f.rows.size).toBe(0);
    expect([...f.locks.values()]).toEqual(['new-owner']);
  });
  test.each(['corrupt', 'expired', 'wrong_source'] as const)(
    'regenerates %s artifacts',
    async (mode) => {
      const f = cacheFixture();
      const opts = options();
      await f.cache.getOrCreate(opts);
      const row = f.rows.get(opts.key)!;
      if (mode === 'corrupt') row.payloadHash = 'wrong';
      else if (mode === 'wrong_source') row.sourceVersion = 'other-version';
      else row.expiresAt = new Date(0);
      await f.cache.getOrCreate(opts);
      expect(opts.create).toHaveBeenCalledTimes(2);
      expect(f.rows.size).toBe(1);
    },
  );
  test('partial discoveries remain usable for the current job but are not successful cache entries', async () => {
    const f = cacheFixture();
    const opts = { ...options(), cacheable: () => false };
    await f.cache.getOrCreate(opts);
    expect(f.rows.size).toBe(0);
    await f.cache.getOrCreate(opts);
    expect(opts.create).toHaveBeenCalledTimes(2);
  });
});

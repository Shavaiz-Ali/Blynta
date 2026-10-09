import { ConfigService } from '@nestjs/config';
import { CreditsService } from './credits.service';
import { usageSample } from './usage-context';
import { INITIAL_PRICING } from './credit-pricing';
import { clipPrice } from './credit-pricing';
import { SourceAuthorizationError } from './source-authorization';

/** Transactional adapter tests the real service, with rollback and serialized conflicting writes.
 * A separate opt-in replica-set test exercises Mongo's actual transactions and unique indexes. */
function fixture(balance = 20, initialized = true) {
  const userId = '507f1f77bcf86cd799439011';
  let state: any = {
    user: {
      _id: userId,
      plan: 'pro',
      creditsBalance: balance,
      creditsReserved: 0,
      totalCreditsUsed: 0,
      creditLedgerInitialized: initialized,
    },
    operations: [],
    entries: [],
    usage: [],
  };
  const query = (value: any): any => {
    const p: any = Promise.resolve(value);
    p.session = () => p;
    p.lean = () => p;
    return p;
  };
  const userDoc = (): any => ({
    ...state.user,
    save: async function () {
      const { save, ...data } = this;
      state.user = structuredClone(data);
      return this;
    },
  });
  const opDoc = (op: any): any =>
    op
      ? {
          ...op,
          save: async function () {
            const { save, ...data } = this;
            state.operations = state.operations.map((o: any) =>
              o.operationId === data.operationId ? structuredClone(data) : o,
            );
            return this;
          },
        }
      : null;
  const users: any = {
    findById: () => query(userDoc()),
    findOneAndUpdate: (filter: any, update: any) => {
      if (
        state.user.creditsBalance < (filter.creditsBalance?.$gte || 0) ||
        state.user.creditsReserved < (filter.creditsReserved?.$gte || 0)
      )
        return query(null);
      for (const [field, delta] of Object.entries(update.$inc))
        state.user[field] = (state.user[field] || 0) + Number(delta);
      return query(userDoc());
    },
  };
  const matches = (o: any, f: any) =>
    Object.entries(f).every(([k, v]) =>
      v === null ? o[k] == null : o[k] === v,
    );
  const operations: any = {
    findOneAndUpdate: async (filter: any, update: any) => {
      const op = state.operations.find((o: any) => matches(o, filter));
      if (!op) return null;
      Object.assign(op, update.$set);
      return opDoc(op);
    },
    findOne: (f: any) =>
      query(opDoc(state.operations.find((o: any) => matches(o, f)))),
    create: async ([value]: any) => {
      if (
        state.operations.some((o: any) => o.operationId === value.operationId)
      )
        throw Object.assign(new Error('Duplicate'), { code: 11000 });
      const op = { charged: 0, generation: 0, status: 'reserved', ...value };
      state.operations.push(structuredClone(op));
      return [opDoc(op)];
    },
  };
  const entries: any = {
    findOne: (f: any) =>
      query(
        state.entries.find((e: any) =>
          Object.entries(f).every(([k, v]) => e[k] === v),
        ),
      ),
    exists: (f: any) => query(state.entries.some((e: any) => e.key === f.key)),
    aggregate: (pipeline: any) => {
      const filter = pipeline[0].$match;
      const rows = state.entries.filter((e: any) =>
        Object.entries(filter).every(([k, v]) =>
          k.startsWith('metadata.')
            ? e.metadata?.[k.slice(9)] === v
            : e[k] === v,
        ),
      );
      return query(
        rows.length
          ? [{ amount: rows.reduce((n: number, e: any) => n + e.amount, 0) }]
          : [],
      );
    },
    create: async ([value]: any) => {
      if (state.entries.some((e: any) => e.key === value.key))
        throw Object.assign(new Error('Duplicate'), { code: 11000 });
      value._id ||= String(state.entries.length + 1);
      state.entries.push(structuredClone(value));
      return [value];
    },
  };
  let pending = Promise.resolve();
  const connection: any = {
    collection: () => ({ findOne: async () => null }),
    startSession: async () => ({
      endSession: async () => {},
      withTransaction: async (fn: any) => {
        const previous = pending;
        let release!: () => void;
        pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const before = structuredClone(state);
        try {
          return await fn();
        } catch (error) {
          state = before;
          throw error;
        } finally {
          release();
        }
      },
    }),
  };
  const service = new CreditsService(
    connection,
    users,
    entries,
    operations,
    {
      updateOne: async (f: any, update: any) => {
        const row = state.usage.find((u: any) => matches(u, f));
        if (row) Object.assign(row, update.$set || {});
        else state.usage.push({ ...f, ...update.$setOnInsert, ...update.$set });
      },
    } as any,
    { get: (_: string, fallback: any) => fallback } as ConfigService,
    { findOne: () => query(null) } as any,
  );
  const reserve = (
    operationId = 'one',
    amount = 18,
    product: 'ai-clips' | 'studio' = 'ai-clips',
  ) =>
    service.reserve({
      userId,
      operationId,
      product,
      relatedId: userId,
      sourceSeconds: 3600,
      maxOutputSeconds: 360,
      fingerprint: 'same',
      amount,
      pricing: INITIAL_PRICING,
    });
  return { service, reserve, userId, state: () => state };
}

describe('authoritative credit operations', () => {
  async function incidentReservation(sourceSeconds = 3233) {
    const f = fixture();
    const amount = clipPrice(sourceSeconds, 540).totalCredits;
    await f.service.reserve({
      userId: f.userId,
      operationId: 'incident',
      product: 'ai-clips',
      relatedId: f.userId,
      sourceSeconds,
      maxOutputSeconds: 540,
      amount,
      fingerprint: 'incident',
      pricing: INITIAL_PRICING,
    });
    return {
      ...f,
      state: () =>
        f.state() as {
          operations: Record<string, unknown>[];
          entries: { type: string }[];
          user: Record<string, unknown>;
        },
    };
  }
  test('measured fractional duration preserves authorization and settles exactly once within the approved maximum', async () => {
    const f = await incidentReservation();
    await f.service.assertSourceBudget('incident', 3233.461);
    expect(f.state().operations[0]).toMatchObject({
      sourceSeconds: 3233,
      authorized: 20,
      held: 20,
      charged: 0,
      pricing: INITIAL_PRICING,
    });
    const charge = clipPrice(3233.461, 540).totalCredits;
    await f.service.settle('incident', charge);
    await f.service.settle('incident', charge);
    expect(f.state().user).toMatchObject({
      creditsBalance: 0,
      creditsReserved: 0,
      totalCreditsUsed: 20,
    });
    expect(
      f.state().entries.filter((e: { type: string }) => e.type === 'charge'),
    ).toHaveLength(1);
  });
  test.each([
    [3233, 3234],
    [300, 300.001],
  ])(
    'overage from %s to %s never charges and terminal failure releases the hold once',
    async (approved, measured) => {
      const f = await incidentReservation(approved);
      await expect(
        f.service.assertSourceBudget('incident', measured),
      ).rejects.toBeInstanceOf(SourceAuthorizationError);
      expect(f.state().entries).toHaveLength(1);
      await f.service.settle('incident', 0);
      await f.service.settle('incident', 0);
      expect(f.state().user).toMatchObject({
        creditsBalance: 20,
        creditsReserved: 0,
        totalCreditsUsed: 0,
      });
      expect(f.state().entries.map((e: { type: string }) => e.type)).toEqual([
        'reserve',
        'release',
      ]);
    },
  );
  test('the displayed clip example uses the active backend pricing', async () => {
    const f = fixture();
    jest.spyOn(f.service, 'pricing').mockReturnValue({
      ...INITIAL_PRICING,
      sourceSeconds: 600,
      outputSeconds: 90,
    });
    const balance = await f.service.balance(f.userId);
    expect(balance.clipExample).toEqual({
      sourceCredits: 3,
      renderCredits: 2,
      totalCredits: 5,
    });
    expect(f.state().entries).toHaveLength(0);
  });
  test('opening migration is idempotent and preserves an existing balance', async () => {
    const f = fixture(27, false);
    await f.service.migrate(f.userId);
    await f.service.migrate(f.userId);
    expect(f.state().user.creditsBalance).toBe(27);
    expect(f.state().entries).toHaveLength(1);
    expect(f.state().entries[0].type).toBe('opening');
  });
  test('two simultaneous products cannot reserve the same credits', async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.reserve('clips', 18),
      f.reserve('studio', 18, 'studio'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.state().user.creditsBalance).toBe(2);
    expect(f.state().user.creditsReserved).toBe(18);
    expect(f.state().operations).toHaveLength(1);
  });
  test('duplicate reservations and settlements charge once', async () => {
    const f = fixture();
    await Promise.all([f.reserve(), f.reserve()]);
    await Promise.all([
      f.service.settle('one', 18),
      f.service.settle('one', 18),
    ]);
    expect(f.state().user).toMatchObject({
      creditsBalance: 2,
      creditsReserved: 0,
      totalCreditsUsed: 18,
    });
    expect(
      f.state().entries.filter((e: any) => e.type === 'charge'),
    ).toHaveLength(1);
  });
  test('an idempotency key cannot be reused for different work', async () => {
    const f = fixture();
    await f.reserve();
    await expect(
      f.service.reserve({
        userId: f.userId,
        operationId: 'one',
        product: 'studio',
        relatedId: f.userId,
        sourceSeconds: 1,
        maxOutputSeconds: 1,
        amount: 1,
        fingerprint: 'different',
      }),
    ).rejects.toThrow();
  });
  test('failed preparation, AI failure and cancellation without delivery release the hold', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 0);
    expect(f.state().user).toMatchObject({
      creditsBalance: 20,
      creditsReserved: 0,
      totalCreditsUsed: 0,
    });
    expect(f.state().entries.map((e: any) => e.type)).toEqual([
      'reserve',
      'release',
    ]);
  });
  test('partial delivery then retry charges only the incremental output', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 16);
    expect(f.state().user).toMatchObject({
      creditsBalance: 4,
      creditsReserved: 0,
    });
    await f.service.reopen('one');
    expect(f.state().user.creditsReserved).toBe(2);
    await f.service.settle('one', 18);
    expect(f.state().user).toMatchObject({
      creditsBalance: 2,
      creditsReserved: 0,
      totalCreditsUsed: 18,
    });
    expect(
      f
        .state()
        .entries.filter((e: any) => e.type === 'charge')
        .map((e: any) => e.amount),
    ).toEqual([16, 2]);
  });
  test('failed retry does not charge delivered source work again', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 16);
    await f.service.reopen('one');
    await f.service.settle('one', 16);
    expect(f.state().user).toMatchObject({
      creditsBalance: 4,
      totalCreditsUsed: 16,
      creditsReserved: 0,
    });
  });
  test('over-budget settlement rolls back without negative balances', async () => {
    const f = fixture();
    await f.reserve();
    await expect(f.service.settle('one', 19)).rejects.toThrow();
    expect(f.state().user).toMatchObject({
      creditsBalance: 2,
      creditsReserved: 18,
      totalCreditsUsed: 0,
    });
  });
  test('failed retry activation rolls the reservation back', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 0);
    await expect(
      f.service.retry('one', async () => {
        throw new Error('Concurrent job claim lost');
      }),
    ).rejects.toThrow();
    expect(f.state().user).toMatchObject({
      creditsBalance: 20,
      creditsReserved: 0,
    });
    expect(f.state().operations[0].status).toBe('settled');
  });
  test('renewal adds credits, duplicate payment/cycle keys grant once', async () => {
    const f = fixture(23);
    await Promise.all([
      f.service.adjust(f.userId, 50, 'cycle-1', 'Renewal'),
      f.service.adjust(f.userId, 50, 'cycle-1', 'Renewal'),
    ]);
    expect(f.state().user.creditsBalance).toBe(73);
    expect(f.state().entries).toHaveLength(1);
  });
  test('admin adjustment cannot spend reserved credits', async () => {
    const f = fixture();
    await f.reserve();
    await expect(
      f.service.adjust(f.userId, -3, 'admin-1', 'Correction', 'adjustment'),
    ).rejects.toThrow();
    expect(f.state().user).toMatchObject({
      creditsBalance: 2,
      creditsReserved: 18,
    });
  });
  test('refund is a compensating immutable entry and idempotent', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 18);
    await f.service.adjust(
      f.userId,
      18,
      'refund-one',
      'Platform correction',
      'refund',
    );
    await f.service.adjust(
      f.userId,
      18,
      'refund-one',
      'Platform correction',
      'refund',
    );
    expect(f.state().user.creditsBalance).toBe(20);
    expect(
      f.state().entries.filter((e: any) => e.type === 'charge'),
    ).toHaveLength(1);
  });
});

describe('subscription allocations and validated refunds', () => {
  test('completed payments grant once per cycle and upgrades top up only the difference', async () => {
    const f = fixture(23);
    await Promise.all([
      f.service.grantSubscriptionCycle(f.userId, 50, 'jan', 'tx-1', 'pro'),
      f.service.grantSubscriptionCycle(f.userId, 50, 'jan', 'tx-1', 'pro'),
    ]);
    await f.service.grantSubscriptionCycle(
      f.userId,
      50,
      'jan',
      'tx-duplicate-payment',
      'pro',
    );
    expect(f.state().user.creditsBalance).toBe(73);
    await f.service.grantSubscriptionCycle(
      f.userId,
      200,
      'jan',
      'tx-upgrade',
      'business',
    );
    expect(f.state().user.creditsBalance).toBe(223);
    await f.service.grantSubscriptionCycle(
      f.userId,
      50,
      'jan',
      'tx-downgrade',
      'pro',
    );
    expect(f.state().user.creditsBalance).toBe(223);
    await f.service.grantSubscriptionCycle(
      f.userId,
      50,
      'feb',
      'tx-renewal',
      'pro',
    );
    expect(f.state().user.creditsBalance).toBe(273);
  });
  test('refunds require an owned charge and cannot exceed its amount', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.settle('one', 18);
    const charge = f.state().entries.find((e: any) => e.type === 'charge');
    await f.service.refund(
      f.userId,
      charge._id,
      10,
      'refund-a',
      'Correction',
      'admin',
    );
    await f.service.refund(
      f.userId,
      charge._id,
      10,
      'refund-a',
      'Correction',
      'admin',
    );
    await expect(
      f.service.refund(
        f.userId,
        charge._id,
        9,
        'refund-b',
        'Correction',
        'admin',
      ),
    ).rejects.toThrow();
    await expect(
      f.service.refund(
        f.userId,
        'missing',
        1,
        'refund-c',
        'Correction',
        'admin',
      ),
    ).rejects.toThrow();
    expect(f.state().user.creditsBalance).toBe(12);
  });
});

describe('Studio AI execution fencing', () => {
  async function ai() {
    const f = fixture();
    await f.service.reserve({
      userId: f.userId,
      operationId: 'ai',
      kind: 'studio-ai',
      product: 'studio',
      relatedId: f.userId,
      sourceSeconds: 0,
      maxOutputSeconds: 0,
      amount: 1,
      fingerprint: 'ai',
      pricing: INITIAL_PRICING,
    });
    return f;
  }
  test('released old execution cannot publish a result after a new retry starts', async () => {
    const f = await ai();
    let finish!: (value: object) => void;
    const old = f.service.executeAi(
      'ai',
      () =>
        new Promise<object>((resolve) => {
          finish = resolve;
        }),
    );
    const rejected = expect(old).rejects.toThrow('authorization expired');
    while (!finish) await Promise.resolve();
    const claimed = f.state().operations[0];
    await f.service.settle('ai', 0, undefined, {
      generation: claimed.generation,
      executionToken: claimed.executionToken,
      missingResult: true,
    });
    const newResult = await f.service.executeAi('ai', async () => ({
      id: 'new',
    }));
    finish({ id: 'old' });
    await rejected;
    expect(newResult).toEqual({ id: 'new' });
    expect(f.state().operations[0].result).toEqual({ id: 'new' });
    expect(f.state().user).toMatchObject({
      creditsBalance: 19,
      creditsReserved: 0,
      totalCreditsUsed: 1,
    });
  });
  test('old failure cannot release a newer attempt hold', async () => {
    const f = await ai();
    let fail!: (error: Error) => void;
    const old = f.service.executeAi(
      'ai',
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const rejected = expect(old).rejects.toThrow('old provider failure');
    while (!fail) await Promise.resolve();
    const first = f.state().operations[0];
    await f.service.settle('ai', 0, undefined, {
      generation: first.generation,
      executionToken: first.executionToken,
      missingResult: true,
    });
    await f.service.reopen('ai');
    fail(new Error('old provider failure'));
    await rejected;
    expect(f.state().operations[0]).toMatchObject({
      status: 'reserved',
      held: 1,
      generation: 1,
    });
  });
  test('recovery snapshot cannot release a result published in the meantime', async () => {
    const f = await ai();
    const snapshot = structuredClone(f.state().operations[0]);
    f.state().operations[0].result = { id: 'durable' };
    await f.service.settle('ai', 0, undefined, {
      generation: snapshot.generation,
      executionToken: snapshot.executionToken,
      missingResult: true,
    });
    expect(f.state().operations[0].status).toBe('reserved');
    await f.service.executeAi('ai', async () => {
      throw new Error('must replay');
    });
    expect(f.state().user.totalCreditsUsed).toBe(1);
  });
});

describe('usage telemetry durability', () => {
  test('multiple operations in one stage have distinct durable sample IDs', async () => {
    const f = fixture();
    await f.reserve();
    await f.service.capture('one', 'attempt', async () => {
      await usageSample('llm', { usage: { inputTokens: 1, outputTokens: 2 } });
      expect(f.state().usage).toHaveLength(1); // Persisted before the processing function returns.
      await usageSample('llm', { usage: { inputTokens: 3, outputTokens: 4 } });
    });
    const rows = f.state().usage.filter((u: any) => u.stage === 'llm');
    expect(rows).toHaveLength(2);
    expect(rows[0].attemptId).not.toBe(rows[1].attemptId);
    expect(f.state().user).toMatchObject({
      creditsBalance: 2,
      creditsReserved: 18,
    });
  });
  test('outbox replay retries failed telemetry with the same sample IDs and preserves enriched records', async () => {
    const f = fixture();
    const pending = new Map<string, string>();
    const redis = {
      hset: async (_: string, k: string, v: string) => {
        pending.set(k, v);
      },
      hdel: async (_: string, k: string) => {
        pending.delete(k);
      },
      hscan: async () => ['0', [...pending].flat()],
    };
    Object.assign(f.service, { telemetryRedis: redis });
    const update = f.service.usage.updateOne.bind(f.service.usage);
    f.service.usage.updateOne = jest
      .fn()
      .mockRejectedValue(new Error('Mongo down'));
    await f.service.capture('one', 'attempt', async () => {
      await usageSample('ffmpeg', { cpuSeconds: 1 });
      return 'delivered';
    });
    expect(pending.size).toBe(1);
    f.service.usage.updateOne = update;
    await f.service.recoverUsage();
    await f.service.recoverUsage();
    expect(pending.size).toBe(0);
    expect(
      f.state().usage.filter((u: any) => u.stage === 'ffmpeg'),
    ).toHaveLength(1);
    expect(f.state().user.creditsBalance).toBe(20);
  });
});

import { ConfigService } from '@nestjs/config';
import { CreditsService } from './credits.service';
import { INITIAL_PRICING } from './credit-pricing';

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
  const operations: any = {
    findOne: (f: any) =>
      query(
        opDoc(
          state.operations.find((o: any) => o.operationId === f.operationId),
        ),
      ),
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
    {} as any,
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

import {
  clipPrice,
  eligibleClipPrice,
  INITIAL_PRICING,
  studioPrice,
  units,
} from './credit-pricing';

describe('published credit pricing', () => {
  test('60 minutes and eight 45-second clips cost 18 credits', () => {
    expect(clipPrice(3600, 8 * 45)).toEqual({
      sourceCredits: 12,
      renderCredits: 6,
      totalCredits: 18,
    });
  });
  test.each([
    [0, 0],
    [0.001, 1],
    [299.999, 1],
    [300, 1],
    [300.001, 2],
    [14400, 48],
  ])('source duration %s rounds to %s', (seconds, result) =>
    expect(units(seconds, 300)).toBe(result),
  );
  test.each([
    [59.99, 1],
    [60, 1],
    [60.01, 2],
    [180, 3],
  ])('Studio %s seconds costs %s', (seconds, result) =>
    expect(studioPrice(seconds)).toBe(result),
  );
  test.each([-1, NaN, Infinity, -Infinity])(
    'rejects invalid duration %s',
    (value) => expect(() => clipPrice(value, 1)).toThrow(),
  );
  test('an old snapshot retains its rates', () => {
    const changed = { ...INITIAL_PRICING, version: 'v2', sourceSeconds: 600 };
    expect(clipPrice(3600, 360, changed).totalCredits).toBe(12);
    expect(clipPrice(3600, 360, INITIAL_PRICING).totalCredits).toBe(18);
  });
  test('no delivered output releases all credits', () =>
    expect(eligibleClipPrice(3600, 0, INITIAL_PRICING)).toBe(0));
  test('partial delivery charges source once and only delivered output', () =>
    expect(eligibleClipPrice(3600, 5 * 45, INITIAL_PRICING)).toBe(16));
  test('premium modifier is deterministic', () =>
    expect(studioPrice(90, { ...INITIAL_PRICING, studioModifier: 2 })).toBe(4));
});

test.each([
  [300, 45, 2],
  [3000, 45, 11],
  [3237.661, 48, 12],
  [3600, 360, 18],
  [300.01, 45, 3],
  [300, 60.01, 3],
])(
  'duration formula for source %s and output %s is %s',
  (source, output, total) => {
    expect(clipPrice(source, output).totalCredits).toBe(total);
  },
);

import { Mongoose } from 'mongoose';
import { CreditEntrySchema, CreditOperationSchema } from './credit.schemas';
const isolated = new Mongoose();
const Entry = isolated.model('ValidationEntry', CreditEntrySchema);
const Operation = isolated.model('ValidationOperation', CreditOperationSchema);
const ledger = {
  userId: 'user',
  key: 'key',
  operationId: 'operation',
  product: 'ai-clips',
  type: 'reserve',
  amount: 15,
  availableDelta: -15,
  reservedDelta: 15,
  availableAfter: 5,
  reservedAfter: 15,
  description: 'Hold',
};
const operation = {
  userId: 'user',
  operationId: 'operation',
  product: 'ai-clips',
  relatedId: 'job',
  authorized: 15,
  held: 15,
  pricing: INITIAL_PRICING,
  sourceSeconds: 3000,
  maxOutputSeconds: 60,
  fingerprint: 'input',
};
test('runtime schema validates enums, safe integers, signed deltas, and pricing snapshots', async () => {
  await expect(new Entry(ledger).validate()).resolves.toBeUndefined();
  await expect(new Operation(operation).validate()).resolves.toBeUndefined();
  for (const values of [
    { amount: 1.5 },
    { amount: -1 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { type: 'oops' },
    { availableAfter: -1 },
    { product: 'oops' },
  ])
    await expect(
      new Entry({ ...ledger, ...values }).validate(),
    ).rejects.toThrow();
  for (const values of [
    { status: 'oops' },
    { held: -1 },
    { held: 16 },
    { status: 'settled', held: 15 },
    { authorized: 1.5 },
    { fingerprint: undefined },
    { pricing: { ...INITIAL_PRICING, sourceSeconds: 0 } },
    { pricing: { ...INITIAL_PRICING, aiCredits: 0.5 } },
  ])
    await expect(
      new Operation({ ...operation, ...values }).validate(),
    ).rejects.toThrow();
});
test('ledger blocks bulk and document deletion before database access', async () => {
  await expect(
    Entry.bulkWrite([{ deleteOne: { filter: { key: 'key' } } }]),
  ).rejects.toThrow('append-only');
  await expect(new Entry(ledger).deleteOne()).rejects.toThrow('append-only');
});

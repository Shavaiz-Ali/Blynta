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

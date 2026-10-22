import { ConfigService } from '@nestjs/config';
import { creditPacks, planCredits } from './credit-config';

describe('credit configuration', () => {
  test('initial plans are 30 once, 50 and 200 with configurable allocations', () => {
    expect(planCredits(new ConfigService())).toEqual({
      free: 30,
      pro: 50,
      business: 200,
    });
    expect(
      planCredits(new ConfigService({ BILLING_FREE_CREDITS: '40' })).free,
    ).toBe(40);
  });
  test.each(['-1', 'NaN', '0', '1.5'])(
    'invalid allocation %s fails closed',
    (value) => {
      expect(() =>
        planCredits(new ConfigService({ BILLING_FREE_CREDITS: value })),
      ).toThrow();
    },
  );
  test('unconfigured packs explain the missing real price without inventing prices', () => {
    expect(
      creditPacks(new ConfigService()).map((p) => [p.credits, p.enabled]),
    ).toEqual([
      [25, false],
      [50, false],
      [100, false],
    ]);
    expect(creditPacks(new ConfigService())[0].configurationError).toContain(
      'PADDLE_PRICE_ID_CREDITS_25',
    );
  });
  test('packs support configured products and quantities; duplicate prices fail closed', () => {
    expect(
      creditPacks(
        new ConfigService({
          BILLING_CREDIT_PACKS_JSON: JSON.stringify([
            { id: 'large', credits: 250, priceId: 'pri_large' },
          ]),
        }),
      )[0],
    ).toMatchObject({ id: 'large', credits: 250, enabled: true });
    expect(() =>
      creditPacks(
        new ConfigService({
          PADDLE_PRICE_ID_CREDITS_25: 'pri_same',
          PADDLE_PRICE_ID_CREDITS_50: 'pri_same',
        }),
      ),
    ).toThrow('distinct');
  });
});

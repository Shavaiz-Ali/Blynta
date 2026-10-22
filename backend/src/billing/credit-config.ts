import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

export const DEFAULT_PLAN_CREDITS = Object.freeze({
  free: 30,
  pro: 50,
  business: 200,
});

export function planCredits(config: ConfigService) {
  const result: Record<keyof typeof DEFAULT_PLAN_CREDITS, number> = {
    ...DEFAULT_PLAN_CREDITS,
  };
  for (const plan of ['free', 'pro', 'business'] as const) {
    const value = Number(
      config.get(`BILLING_${plan.toUpperCase()}_CREDITS`, result[plan]),
    );
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new ServiceUnavailableException(
        `Invalid BILLING_${plan.toUpperCase()}_CREDITS`,
      );
    result[plan] = value;
  }
  return result;
}

export function creditPacks(config: ConfigService) {
  const raw = config.get<string>('BILLING_CREDIT_PACKS_JSON');
  if (raw) {
    try {
      const packs = z
        .array(
          z
            .object({
              id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
              credits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
              priceId: z.string().regex(/^pri_[a-z0-9]+$/),
            })
            .strict(),
        )
        .min(1)
        .max(20)
        .parse(JSON.parse(raw));
      if (
        new Set(packs.map((p) => p.id)).size !== packs.length ||
        new Set(packs.map((p) => p.priceId)).size !== packs.length
      )
        throw new Error('Duplicate pack IDs or prices');
      return packs.map((p) => ({
        ...p,
        enabled: true,
        configurationError: null as string | null,
      }));
    } catch {
      throw new ServiceUnavailableException(
        'Invalid BILLING_CREDIT_PACKS_JSON',
      );
    }
  }
  const packs = [25, 50, 100].map((credits) => {
    const variable = `PADDLE_PRICE_ID_CREDITS_${credits}`;
    const priceId = config.get<string>(variable);
    return {
      id: String(credits),
      credits,
      priceId,
      enabled: !!priceId,
      configurationError: priceId ? null : `Missing ${variable}`,
    };
  });
  const ids = packs.flatMap((p) => (p.priceId ? [p.priceId] : []));
  if (new Set(ids).size !== ids.length)
    throw new ServiceUnavailableException(
      'Credit packs must have distinct Paddle price IDs',
    );
  return packs;
}

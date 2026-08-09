import { z } from 'zod';

export const CreateCheckoutSessionDto = z.object({
  plan: z.enum(['pro', 'business']),
});

export type CreateCheckoutSessionDto = z.infer<typeof CreateCheckoutSessionDto>;

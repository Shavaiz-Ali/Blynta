import { z } from 'zod';
import { objectId } from '../ai-editor/edit-plan.contract';
export const aiTask = z.enum([
  'highlight_detection',
  'edit_planning',
  'edit_refinement',
]);
export type AITask = z.infer<typeof aiTask>;
export const providerInput = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    name: z.string().min(1).max(100),
    adapter: z.enum(['google', 'openai', 'anthropic']),
    enabled: z.boolean().default(false),
    description: z.string().max(500).optional(),
    defaultCredentialId: objectId.nullable().optional(),
  })
  .strict();
export const credentialInput = z
  .object({
    label: z.string().min(1).max(100),
    secret: z
      .string()
      .trim()
      .min(12)
      .max(512)
      .refine(
        (s) => !/[•*]/.test(s),
        'Submit a new secret, not a masked placeholder',
      ),
    enabled: z.boolean().default(true),
  })
  .strict();
export const credentialUpdate = credentialInput
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const modelInput = z
  .object({
    providerId: objectId,
    credentialId: objectId.nullable().optional(),
    modelId: z.string().regex(/^gemini-[a-zA-Z0-9.-]{1,100}$/),
    displayName: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    enabled: z.boolean().default(false),
    capabilities: z
      .object({
        text: z.boolean(),
        vision: z.boolean(),
        audioInput: z.boolean(),
        structuredOutput: z.boolean(),
        toolCalling: z.boolean(),
      })
      .strict(),
    tasks: z.array(aiTask).min(1).max(3).optional(),
    settings: z
      .object({
        temperature: z.number().finite().min(0).max(2).optional(),
        maxOutputTokens: z.number().int().min(128).max(8192).default(4096),
        timeoutMs: z.number().int().min(1000).max(60000).default(30000),
        maxRetries: z.literal(0).default(0),
      })
      .strict(),
    access: z
      .object({
        allowedPlans: z
          .array(z.enum(['free', 'pro', 'business']))
          .min(1)
          .max(3),
        selectable: z.boolean(),
      })
      .strict(),
    pricing: z
      .object({
        inputCostPerMillionTokens: z.number().finite().min(0).max(10000),
        outputCostPerMillionTokens: z.number().finite().min(0).max(10000),
        currency: z.literal('USD'),
      })
      .strict()
      .optional(),
    priority: z.number().int().min(0).max(1000).default(100),
  })
  .strict();
export const listInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    search: z.string().max(100).optional(),
    enabled: z.enum(['true', 'false']).optional(),
    providerId: objectId.optional(),
  })
  .strict();
export type ProviderInput = z.infer<typeof providerInput>;
export type ModelInput = z.infer<typeof modelInput>;

// Zod defaults inside optional fields must not turn PATCH into implicit writes.
export function providedFields<T extends object>(parsed: T, body: unknown): T {
  const keys = new Set(Object.keys(body as object));
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => keys.has(key)),
  ) as T;
}

import { z } from 'zod';
import { objectId } from '../ai-editor/edit-plan.contract';
import {
  AI_TASKS,
  AI_ADAPTERS,
  SUBSCRIPTION_PLANS,
  PAGINATION,
  AI_MODEL_POLICY,
} from '@blynta/types/contracts';
export const aiTask = z.enum(AI_TASKS);
export type AITask = z.infer<typeof aiTask>;
export const providerInput = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    name: z.string().min(1).max(100),
    adapter: z.enum(AI_ADAPTERS),
    baseUrl: z.string().max(512).optional(),
    apiVersion: z.string().max(30).optional(),
    settings: z
      .object({
        timeoutMs: z
          .number()
          .int()
          .min(AI_MODEL_POLICY.TIMEOUT_MS.MIN)
          .max(AI_MODEL_POLICY.TIMEOUT_MS.MAX)
          .optional(),
        maxRetries: z.literal(AI_MODEL_POLICY.MAX_RETRIES).optional(),
      })
      .strict()
      .optional(),
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
        temperature: z
          .number()
          .finite()
          .min(AI_MODEL_POLICY.TEMPERATURE.MIN)
          .max(AI_MODEL_POLICY.TEMPERATURE.MAX)
          .optional(),
        maxOutputTokens: z
          .number()
          .int()
          .min(AI_MODEL_POLICY.OUTPUT_TOKENS.MIN)
          .max(AI_MODEL_POLICY.OUTPUT_TOKENS.MAX)
          .default(AI_MODEL_POLICY.OUTPUT_TOKENS.DEFAULT),
        timeoutMs: z
          .number()
          .int()
          .min(AI_MODEL_POLICY.TIMEOUT_MS.MIN)
          .max(AI_MODEL_POLICY.TIMEOUT_MS.MAX)
          .default(AI_MODEL_POLICY.TIMEOUT_MS.DEFAULT),
        maxRetries: z
          .literal(AI_MODEL_POLICY.MAX_RETRIES)
          .default(AI_MODEL_POLICY.MAX_RETRIES),
      })
      .strict(),
    access: z
      .object({
        allowedPlans: z.array(z.enum(SUBSCRIPTION_PLANS)).min(1).max(3),
        selectable: z.boolean(),
      })
      .strict(),
    pricing: z
      .object({
        inputCostPerMillionTokens: z
          .number()
          .finite()
          .min(0)
          .max(AI_MODEL_POLICY.MAX_TOKEN_PRICE_USD),
        outputCostPerMillionTokens: z
          .number()
          .finite()
          .min(0)
          .max(AI_MODEL_POLICY.MAX_TOKEN_PRICE_USD),
        currency: z.literal('USD'),
      })
      .strict()
      .optional(),
    priority: z
      .number()
      .int()
      .min(AI_MODEL_POLICY.PRIORITY.MIN)
      .max(AI_MODEL_POLICY.PRIORITY.MAX)
      .default(AI_MODEL_POLICY.PRIORITY.DEFAULT),
  })
  .strict();
export const listInput = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(PAGINATION.DEFAULT_PAGE)
      .max(PAGINATION.MAX_PAGE)
      .default(PAGINATION.DEFAULT_PAGE),
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

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[\w-]+$/);
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .transform((value) => value.toLowerCase());
const time = n(0, 600);
const interval = z.object({ start: time, end: time }).strict();
const color = z.string().regex(/^#[a-f\d]{6}$/i);
export const cropSchema = z
  .object({ x: n(0, 1), y: n(0, 1), width: n(0.05, 1), height: n(0.05, 1) })
  .strict();
const segmentSchema = z.discriminatedUnion('type', [
  z
    .object({
      id,
      type: z.literal('video'),
      sourceStart: time,
      sourceEnd: time,
      crossfade: n(0, 3).default(0),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('freeze_frame'),
      sourceTime: time,
      duration: n(0.1, 10),
      audio: z.literal('silence'),
      crossfade: z.literal(0).default(0),
    })
    .strict(),
]);
const base = {
  id,
  start: time,
  end: time,
  enabled: z.boolean().default(true),
  source: z.enum(['system', 'user', 'ai']).default('user'),
  metadata: z
    .record(z.string().max(80), z.string().max(300))
    .refine(
      (value) => Object.keys(value).length <= 20,
      'Metadata may contain at most 20 fields',
    )
    .optional(),
};
const position = { x: n(0, 1), y: n(0, 1) };
const imageParams = {
  assetId: id,
  ...position,
  width: n(0.01, 1),
  opacity: n(0, 1).default(1),
  fadeIn: n(0, 3).default(0),
  fadeOut: n(0, 3).default(0),
};
export const operationSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...base,
      type: z.literal('zoom'),
      params: z
        .object({
          fromScale: n(1, 3),
          toScale: n(1, 3),
          focusX: n(0, 1),
          focusY: n(0, 1),
          easing: z.enum(['linear', 'easeInOut']).default('linear'),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...base, type: z.literal('crop'), params: cropSchema }).strict(),
  z
    .object({
      ...base,
      type: z.literal('image_overlay'),
      params: z.object(imageParams).strict(),
    })
    .strict(),
  // Emoji use reviewed PNG assets, never a platform-dependent color emoji font.
  z
    .object({
      ...base,
      type: z.literal('emoji_overlay'),
      params: z
        .object({ ...imageParams, emoji: z.string().min(1).max(32) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('text_overlay'),
      params: z
        .object({
          text: z.string().min(1).max(1000),
          ...position,
          font: z.enum(['sans', 'serif', 'mono']).default('sans'),
          fontSize: n(8, 160),
          color,
          outline: n(0, 8).default(0),
          shadow: z.boolean().default(false),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('transition'),
      params: z.object({ kind: z.enum(['fade_in', 'fade_out']) }).strict(),
    })
    .strict(),
]);
const automationSchema = z.object({ time, gain: n(0, 2) }).strict();
const controls = {
  enabled: z.boolean().default(true),
  gain: n(0, 2).default(1),
  fadeIn: n(0, 30).default(0),
  fadeOut: n(0, 30).default(0),
  mutes: z.array(interval).max(30).default([]),
  automation: z.array(automationSchema).max(40).default([]),
};
export const planSchema = z
  .object({
    schemaVersion: z.literal(1),
    timestampSystem: z.literal('output_seconds'),
    mode: z.literal('manual').default('manual'),
    video: z
      .object({
        aspectRatio: z
          .enum(['preserve', '16:9', '9:16', '1:1', '4:5'])
          .default('preserve'),
        resolution: z.enum(['720p', '1080p']).default('720p'),
        fps: z.union([z.literal(24), z.literal(30)]).default(30),
        crop: cropSchema.optional(),
        segments: z.array(segmentSchema).min(1).max(24),
      })
      .strict(),
    audio: z
      .object({
        original: z.object(controls).strict(),
        tracks: z
          .array(
            z
              .object({
                id,
                role: z.enum(['music_track', 'sound_effect', 'voiceover']),
                assetId: id,
                start: time,
                sourceStart: time,
                sourceEnd: time,
                ...controls,
              })
              .strict(),
          )
          .max(8),
      })
      .strict(),
    operations: z.array(operationSchema).max(60),
    captions: z
      .array(
        z
          .object({
            id,
            language: z.string().max(40),
            script: z.string().max(40),
            sourceReference: id.optional(),
            visible: z.boolean(),
            burnIn: z.boolean(),
            style: z
              .object({
                font: z.enum(['sans', 'serif', 'mono']),
                fontSize: n(8, 100),
                color,
              })
              .strict(),
            cues: z
              .array(
                z
                  .object({
                    start: time,
                    end: time,
                    text: z.string().min(1).max(1000),
                  })
                  .strict(),
              )
              .max(150),
          })
          .strict(),
      )
      .max(3)
      .default([]),
  })
  .strict();
export type EditPlan = z.infer<typeof planSchema>;
export type EditOperation = z.infer<typeof operationSchema>;
export type AudioControls = EditPlan['audio']['original'];
export const createPlanSchema = z
  .object({ jobId: objectId, clipId: objectId, plan: planSchema })
  .strict();
export const updatePlanSchema = z
  .object({ revision: z.number().int().min(1), plan: planSchema })
  .strict();
export function parseEdit<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException({
      message: 'EditPlan validation failed',
      code: 'INVALID_EDIT_PLAN',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  return parsed.data;
}

/** Phase 2 boundary: a director proposes data; persistence and rendering still validate it. */
export interface EditingDirector {
  propose(input: {
    instructions: string;
    plan: Readonly<EditPlan>;
    sourceDuration: number;
  }): Promise<unknown>;
}

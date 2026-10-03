import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const ratioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);
export const assetSchema = z
  .object({
    id,
    name: z.string().min(1).max(2000),
    kind: z.enum(['video', 'audio', 'image', 'text']),
    duration: number(0.01, 14400),
    origin: z.enum(['Upload', 'Text', 'Blynta']),
    sourceGroup: z
      .enum([
        'Original source',
        'Generated clips',
        'Uploads',
        'Audio',
        'Images',
      ])
      .optional(),
  })
  .strict();
export const clipSchema = z
  .object({
    id,
    assetId: id,
    trackId: id,
    name: z.string().max(2000),
    kind: z.enum(['video', 'audio', 'image', 'text']),
    start: number(0, 3600),
    duration: number(0.01, 3600),
    offset: number(0, 14400),
    opacity: number(0, 100),
    scale: number(10, 300),
    rotation: number(-180, 180),
    volume: number(0, 100),
    speed: number(0.25, 2),
    x: number(-2000, 2000),
    y: number(-2000, 2000),
    fontSize: number(8, 200),
    fontFamily: z.enum(['Arial', 'Georgia', 'Courier New']).optional(),
    fontWeight: z.union([z.literal(400), z.literal(700)]).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    letterSpacing: z.literal(0).optional(),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    fadeIn: number(0, 10),
    fadeOut: number(0, 10),
    fit: z.enum(['contain', 'cover']),
  })
  .strict();
export const documentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    ratio: ratioSchema,
    assets: z.array(assetSchema).max(200),
    clips: z.array(clipSchema).max(150),
    tracks: z
      .array(
        z
          .object({
            id,
            name: z.string().max(80),
            kind: z.enum(['video', 'audio', 'image', 'text']),
            muted: z.boolean(),
            hidden: z.boolean(),
            locked: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((doc, ctx) => {
    for (const items of [doc.assets, doc.clips, doc.tracks])
      if (new Set(items.map((x: { id: string }) => x.id)).size !== items.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate timeline IDs' });
    for (const c of doc.clips) {
      const a = doc.assets.find((a) => a.id === c.assetId);
      const t = doc.tracks.find((t) => t.id === c.trackId);
      if (
        !a ||
        a.kind !== c.kind ||
        !t ||
        (t.kind !== c.kind && !(t.kind === 'video' && c.kind === 'image'))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid asset or track reference',
        });
      if (
        c.start + c.duration > 3600 ||
        (a &&
          !['image', 'text'].includes(c.kind) &&
          c.offset + c.duration * c.speed > a.duration + 0.1)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Clip exceeds media or timeline duration',
        });
    }
  });
export type StudioDocument = z.infer<typeof documentSchema>;
export const actionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('trim'),
      seconds: number(0.01, 3600),
      targetClipId: id.optional(),
    })
    .strict(),
  z.object({ type: z.literal('ratio'), ratio: ratioSchema }).strict(),
  z
    .object({
      type: z.literal('volume'),
      volume: number(0, 100),
      targetClipId: id.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('captions'),
      segments: z
        .array(
          z.object({
            start: number(0, 3600),
            end: number(0, 3600),
            text: z.string().max(2000),
          }),
        )
        .max(150),
    })
    .strict(),
]);
export const proposalSchema = z.object({
  actions: z.array(actionSchema).max(10),
  descriptions: z.array(z.string().max(300)).min(1).max(10),
});
export const settingsSchema = z
  .object({
    resolution: z.enum(['720p', '1080p']),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    format: z.literal('mp4'),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues[0]?.message || 'Invalid Studio request',
    );
  return result.data;
}
export const defaultTracks: StudioDocument['tracks'] = [
  { id: 'text', name: 'Text 1', kind: 'text', muted: false, hidden: false },
  {
    id: 'overlay',
    name: 'Video 2',
    kind: 'video',
    muted: false,
    hidden: false,
  },
  { id: 'video', name: 'Video 1', kind: 'video', muted: false, hidden: false },
  { id: 'audio', name: 'Audio 1', kind: 'audio', muted: false, hidden: false },
];
export function makeClip(
  asset: z.infer<typeof assetSchema>,
): StudioDocument['clips'][number] {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    trackId:
      asset.kind === 'audio'
        ? 'audio'
        : asset.kind === 'text'
          ? 'text'
          : 'video',
    name: asset.name,
    kind: asset.kind,
    start: 0,
    duration: asset.duration,
    offset: 0,
    opacity: 100,
    scale: 100,
    rotation: 0,
    volume: 80,
    speed: 1,
    x: 0,
    y: 0,
    fontSize: 34,
    fontFamily: 'Arial',
    fontWeight: 700,
    color: '#ffffff',
    fadeIn: 0,
    fadeOut: 0,
    fit: 'contain',
  };
}

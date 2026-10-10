import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { operationSchema, parseEdit, planSchema } from '../edit-plan.contract';
import type { EditPlan } from '../edit-plan.contract';
const operationId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[\w-]+$/);
const audioTrack = planSchema.shape.audio.shape.tracks.element;
const originalAudio = planSchema.shape.audio.shape.original;
export const editPatchSchema = z
  .object({
    baseRevision: z.number().int().min(1),
    changes: z
      .array(
        z.discriminatedUnion('action', [
          z
            .object({ action: z.literal('add_audio_track'), track: audioTrack })
            .strict(),
          z
            .object({
              action: z.literal('update_audio_track'),
              trackId: operationId,
              track: audioTrack,
            })
            .strict(),
          z
            .object({
              action: z.enum([
                'remove_audio_track',
                'enable_audio_track',
                'disable_audio_track',
              ]),
              trackId: operationId,
            })
            .strict(),
          z
            .object({
              action: z.literal('update_original_audio'),
              controls: originalAudio,
            })
            .strict(),
          z
            .object({ action: z.literal('add'), operation: operationSchema })
            .strict(),
          z
            .object({
              action: z.literal('update'),
              operationId,
              operation: operationSchema,
            })
            .strict(),
          z
            .object({
              action: z.enum(['remove', 'enable', 'disable']),
              operationId,
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type EditPatch = z.infer<typeof editPatchSchema>;
export function mergeEditPatch(
  plan: EditPlan,
  revision: number,
  input: unknown,
) {
  const patch = parseEdit(editPatchSchema, input);
  if (patch.baseRevision !== revision)
    throw new ConflictException(
      'Proposal is stale; generate a proposal from the latest revision',
    );
  const result = structuredClone(plan);
  const touched = new Set<string>();
  for (const change of patch.changes) {
    if (change.action === 'update_original_audio') {
      if (touched.has('original_audio'))
        throw new BadRequestException(
          'Original audio may be changed once per patch',
        );
      touched.add('original_audio');
      result.audio.original = change.controls;
      continue;
    }
    if (change.action === 'add_audio_track' || 'trackId' in change) {
      const id =
        change.action === 'add_audio_track' ? change.track.id : change.trackId;
      if (touched.has('audio:' + id))
        throw new BadRequestException(
          'Audio track may be changed once per patch',
        );
      touched.add('audio:' + id);
      const index = result.audio.tracks.findIndex((t) => t.id === id);
      if (change.action === 'add_audio_track') {
        if (index !== -1)
          throw new ConflictException('Audio track ID already exists');
        result.audio.tracks.push(change.track);
      } else {
        if (index === -1)
          throw new BadRequestException('Audio track does not exist');
        if (change.action === 'remove_audio_track')
          result.audio.tracks.splice(index, 1);
        else if (change.action === 'update_audio_track') {
          if (
            change.track.id !== id ||
            change.track.role !== result.audio.tracks[index].role
          )
            throw new BadRequestException(
              'Audio updates preserve track identity and role',
            );
          result.audio.tracks[index] = change.track;
        } else
          result.audio.tracks[index].enabled =
            change.action === 'enable_audio_track';
      }
      continue;
    }
    const id =
      change.action === 'add' ? change.operation.id : change.operationId;
    if (touched.has('operation:' + id))
      throw new BadRequestException(
        'Each operation may be changed once per patch',
      );
    touched.add('operation:' + id);
    const index = result.operations.findIndex((o) => o.id === id);
    if (change.action === 'add') {
      if (index !== -1)
        throw new ConflictException('Operation ID already exists');
      result.operations.push({ ...change.operation, source: 'ai' });
    } else {
      if (index === -1)
        throw new BadRequestException('Operation does not exist');
      if (change.action === 'remove') result.operations.splice(index, 1);
      else if (change.action === 'update') {
        if (
          change.operation.id !== id ||
          change.operation.type !== result.operations[index].type
        )
          throw new BadRequestException(
            'Updates preserve operation identity and type',
          );
        result.operations[index] = { ...change.operation, source: 'ai' };
      } else result.operations[index].enabled = change.action === 'enable';
    }
  }
  return { patch, plan: parseEdit(planSchema, result) };
}

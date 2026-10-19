import { z } from 'zod';
import { operationSchema, planSchema } from '../edit-plan.contract';
import { editPatchSchema } from './edit-patch';
import { SUPPORTED_EMOJIS, SUPPORTED_SHAPES } from './emoji-artwork';

/** The validator/compiler's operation union is the planning source of truth. */
export const editingCapabilities = {
  operations: operationSchema.options.map((option) => option.shape.type.value),
  operationContract: z.toJSONSchema(operationSchema, { io: 'input' }),
  patchContract: z.toJSONSchema(editPatchSchema, { io: 'input' }),
  originalAudioContract: z.toJSONSchema(planSchema.shape.audio.shape.original, {
    io: 'input',
  }),
  overlayCoordinates: {
    center: { x: 0.5, y: 0.5 },
    timing:
      'Output seconds; start 0 and end equal to compiled output duration is supported.',
  },
  unavailableCapabilities: [
    'face_tracking',
    'speech_translation',
    'animated_image_overlay',
  ] as const,
  assets: {
    image: { mimeTypes: ['image/png'], ownershipRequired: true },
    audio: { ownershipRequired: true },
    deterministicEmoji: SUPPORTED_EMOJIS,
    deterministicShapes: SUPPORTED_SHAPES,
    shapeConstraints:
      'Arrow points right; rectangle has a fixed 4:3 visible shape. Color is a six-digit hex value. Other directions or custom geometry require an uploaded PNG.',
    // The registry currently describes text/vision/audio INPUT, not image output.
    imageGeneration: false,
    fallback:
      'Select an owned PNG/audio asset or upload the requested media. Ask which asset when multiple names match. Never substitute unrelated media.',
  },
} as const;

/** Intent needs capability names/dependencies, not duplicate copies of every schema. */
export const planningCapabilities = {
  operations: editingCapabilities.operations,
  overlayCoordinates: editingCapabilities.overlayCoordinates,
  unavailableCapabilities: editingCapabilities.unavailableCapabilities,
  assets: editingCapabilities.assets,
} as const;

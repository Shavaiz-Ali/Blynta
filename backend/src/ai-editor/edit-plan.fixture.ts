import { parseEdit, planSchema } from './edit-plan.contract';
export function examplePlan() {
  return parseEdit(planSchema, {
    schemaVersion: 1,
    timestampSystem: 'output_seconds',
    video: {
      aspectRatio: '16:9',
      segments: [{ id: 'main', type: 'video', sourceStart: 0, sourceEnd: 3 }],
    },
    audio: { original: {}, tracks: [] },
    operations: [],
  });
}

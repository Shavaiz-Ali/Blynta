import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface UsageSample {
  stage: string;
  id: string;
  metrics: Record<string, unknown>;
}
export const usageExecution = new AsyncLocalStorage<{
  samples: UsageSample[];
  pending: Set<Promise<void>>;
  persist: (sample: UsageSample) => Promise<void>;
}>();
export function usageSample(stage: string, metrics: Record<string, unknown>) {
  const context = usageExecution.getStore();
  if (!context) return Promise.resolve();
  const sample = { stage, id: randomUUID(), metrics };
  context.samples.push(sample);
  const pending = context.persist(sample).catch(() => {});
  context.pending.add(pending);
  void pending.finally(() => context.pending.delete(pending));
  return pending;
}

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface UsageSample {
  stage: string;
  id: string;
  metrics: Record<string, unknown>;
}
export const usageExecution = new AsyncLocalStorage<UsageSample[]>();
export function usageSample(stage: string, metrics: Record<string, unknown>) {
  usageExecution.getStore()?.push({ stage, id: randomUUID(), metrics });
}

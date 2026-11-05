import { AsyncLocalStorage } from 'node:async_hooks';

export interface R2ObjectContext {
  jobId?: string;
  clipId?: string;
  batchJobId?: string;
  artifactType?: string;
  expectedToExist?: boolean;
}

export const r2ObjectContext = new AsyncLocalStorage<R2ObjectContext>();
export function withR2ObjectContext<T>(
  context: R2ObjectContext,
  work: () => T,
): T {
  const parent = r2ObjectContext.getStore();
  return r2ObjectContext.run(
    {
      jobId: context.jobId ?? parent?.jobId,
      clipId: context.clipId ?? parent?.clipId,
      batchJobId: context.batchJobId ?? parent?.batchJobId,
      artifactType: context.artifactType ?? parent?.artifactType,
      expectedToExist: context.expectedToExist ?? parent?.expectedToExist,
    },
    work,
  );
}

export function isObjectMissing(error: unknown): boolean {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  const status = value?.$metadata?.httpStatusCode;
  return (
    status === 404 ||
    (status === undefined &&
      ['NotFound', 'NoSuchKey'].includes(value?.name ?? ''))
  );
}

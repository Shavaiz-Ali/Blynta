import type { CaptionStyleConfig } from '../media/style-presets';
import type { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { STORAGE_POLICY } from '../storage/storage.constants';

export function assertBatchStorage(config: ConfigService) {
  const source = config.get<string>('R2_SOURCE_BUCKET_NAME');
  const output = config.get<string>('R2_BUCKET_NAME');
  const endpoint = config.get<string>('R2_ENDPOINT', '');
  if (
    typeof source !== 'string' ||
    !source.trim() ||
    source !== source.trim() ||
    typeof output !== 'string' ||
    !output.trim() ||
    output !== output.trim()
  )
    throw new UnrecoverableError(
      'Batch rendering requires R2_SOURCE_BUCKET_NAME and R2_BUCKET_NAME',
    );
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new UnrecoverableError(
      'Batch rendering requires a valid HTTPS R2_ENDPOINT',
    );
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new UnrecoverableError(
      'Batch rendering requires a valid HTTPS R2_ENDPOINT without credentials, query or fragment',
    );
  // Public bucket access cannot protect source/manifest prefixes with per-object ACLs.
  if (source === output && config.get<string>('R2_PUBLIC_DOMAIN'))
    throw new UnrecoverableError(
      'A shared R2 bucket must remain private: unset R2_PUBLIC_DOMAIN and use signed URLs',
    );
}

/** Keep persisted keys unchanged; reject unsafe paths and writes that could clobber inputs. */
export function assertBatchTaskKeys(task: RenderTask, prefix: string) {
  const safeKey = (key: unknown): key is string =>
    typeof key === 'string' &&
    Buffer.byteLength(key, 'utf8') <= 1024 &&
    !key.includes('\\') &&
    [...key].every(
      (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
    ) &&
    key
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..');
  if (
    !task ||
    !/^job-sources\/batch\/[a-f0-9]{64}$/.test(prefix) ||
    task.outputKey !== `${prefix}/output.mp4`
  )
    throw new UnrecoverableError('Invalid Batch output key');
  const writes = new Set(
    ['task.json', 'progress.json', 'result.json', 'output.mp4'].map(
      (name) => `${prefix}/${name}`,
    ),
  );
  if (task.kind === 'clip') {
    if (
      !safeKey(task.sourceKey) ||
      !STORAGE_POLICY.SOURCE_PREFIXES.some((p) =>
        task.sourceKey.startsWith(p),
      ) ||
      writes.has(task.sourceKey)
    )
      throw new UnrecoverableError(
        'Invalid Batch source key or source/output collision',
      );
  } else if (task.kind === 'edit') {
    if (
      !Array.isArray(task.files) ||
      task.files.some(
        (file) =>
          !safeKey(file.key) ||
          !file.key.startsWith(`${prefix}/inputs/`) ||
          writes.has(file.key),
      )
    )
      throw new UnrecoverableError('Invalid Batch staged input key');
  } else throw new UnrecoverableError('Invalid Batch task kind');
}

export type RenderTask = {
  version: 1;
  outputKey: string;
  deadline: number;
} & (
  | {
      kind: 'clip';
      sourceKey: string;
      start: number;
      end: number;
      segments: { startTime: number; endTime: number; text: string }[];
      style: CaptionStyleConfig;
    }
  | {
      kind: 'edit';
      files: { name: string; key: string; size: number; etag?: string }[];
      args: string[];
      duration: number;
    }
);

export interface RenderResult {
  jobId: string;
  outputKey: string;
  bytes: number;
  cuttingSeconds?: number;
  captioningSeconds?: number;
}

export function renderMode(value: unknown = 'local') {
  if (value !== 'local' && value !== 'aws_batch')
    throw new UnrecoverableError(
      'RENDER_EXECUTION_MODE must be local or aws_batch',
    );
  return value;
}

export function integerSetting(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new UnrecoverableError(
      `Renderer setting must be an integer in ${min}..${max}`,
    );
  return n;
}

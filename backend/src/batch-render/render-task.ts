import type { CaptionStyleConfig } from '../media/style-presets';
import type { ConfigService } from '@nestjs/config';

export function assertBatchStorage(config: ConfigService) {
  const source = config.get<string>('R2_SOURCE_BUCKET_NAME');
  const output = config.get<string>('R2_BUCKET_NAME');
  const endpoint = config.get<string>('R2_ENDPOINT', '');
  if (
    !source ||
    !output ||
    source === output ||
    !endpoint.startsWith('https://')
  )
    throw new Error(
      'Batch rendering requires HTTPS R2 and separate private source/output buckets',
    );
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
    throw new Error('RENDER_EXECUTION_MODE must be local or aws_batch');
  return value;
}

export function integerSetting(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Renderer setting must be an integer in ${min}..${max}`);
  return n;
}

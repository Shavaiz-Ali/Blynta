import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readBuildInfo():
  | {
      revision: string;
      sourceDirty: boolean;
      builtAt: string;
      artifactHash: string;
    }
  | { revision: 'unknown' } {
  try {
    const value: unknown = JSON.parse(
      readFileSync(join(__dirname, '../../build-info.json'), 'utf8'),
    );
    if (
      value &&
      typeof value === 'object' &&
      'revision' in value &&
      typeof value.revision === 'string' &&
      /^[a-f0-9]{40}$/.test(value.revision) &&
      'artifactHash' in value &&
      typeof value.artifactHash === 'string' &&
      /^[a-f0-9]{64}$/.test(value.artifactHash) &&
      'sourceDirty' in value &&
      typeof value.sourceDirty === 'boolean' &&
      'builtAt' in value &&
      typeof value.builtAt === 'string' &&
      !Number.isNaN(Date.parse(value.builtAt))
    ) {
      return {
        revision: value.revision,
        sourceDirty: value.sourceDirty,
        builtAt: value.builtAt,
        artifactHash: value.artifactHash,
      };
    }
  } catch {
    /* Older builds have no manifest; never infer their revision. */
  }
  return { revision: 'unknown' };
}

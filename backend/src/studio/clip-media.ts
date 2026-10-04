import type { Clip } from '../jobs/schemas/job.schema';

/** Canonical identities are keys, never playback/download URLs or local paths. */
function isObjectKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !/[:?#\\\s]/.test(value) &&
    !value.startsWith('/') &&
    !value.split('/').some((part) => part === '.' || part === '..')
  );
}

export function clipMediaCandidates(
  clip: Clip,
  jobId: string,
  index: number,
): string[] {
  if (isObjectKey(clip.r2ObjectKey)) return [clip.r2ObjectKey];
  // Legacy outputUrl sometimes contains the persistent key. Only accept the
  // owned job's namespace; don't trust remote URLs or reconstruct their origins.
  const prefix = `clips/${jobId}/`;
  const candidates =
    isObjectKey(clip.outputUrl) && clip.outputUrl.startsWith(prefix)
      ? [clip.outputUrl]
      : [];
  // The existing worker's output convention also recovers older records with
  // only an expiring URL. Every candidate must pass an R2 HEAD before import.
  candidates.push(
    `${prefix}clip-${index + 1}-captioned.mp4`,
    `${prefix}clip-${index + 1}.mp4`,
  );
  return [...new Set(candidates)];
}

import { createHash } from 'node:crypto';
import type { TranscriptSegmentDto } from './services/transcription.service';

export const DETECTION_VERSION = 'quality-discovery-v3';
export const TRANSCRIPT_VERSION = 'timestamped-transcript-v1';
export const MIN_HIGHLIGHT_SCORE = 0.7;

export function normalizeInstructions(prompt?: string): string {
  return (prompt ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

/** Explicit sorting makes identity independent of object property insertion order. */
export function artifactHash(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, v]) => [key, canonical(v)]),
      );
    return input;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function transcriptIsValid(
  segments: TranscriptSegmentDto[],
  duration: number,
): boolean {
  return (
    Array.isArray(segments) &&
    segments.length > 0 &&
    segments.every(
      (s) =>
        typeof s.text === 'string' &&
        s.text.trim().length > 0 &&
        Number.isFinite(s.startTime) &&
        Number.isFinite(s.endTime) &&
        s.startTime >= 0 &&
        s.endTime > s.startTime &&
        s.endTime <= duration + 30,
    )
  );
}

export function highlightIdentity(input: {
  source: string;
  transcript: string;
  preset: string;
  presetInstructions: string;
  customPrompt?: string;
  owner: string;
  template: string;
  configuration: unknown;
  version?: string;
}): string {
  const prompt = normalizeInstructions(input.customPrompt);
  return artifactHash({
    source: input.source,
    transcript: input.transcript,
    preset: input.preset,
    instructions: normalizeInstructions(input.presetInstructions),
    custom: prompt ? { hash: artifactHash(prompt), owner: input.owner } : null,
    template: input.template,
    configuration: input.configuration,
    version: input.version ?? DETECTION_VERSION,
  });
}

import { createHash } from 'node:crypto';
import { Document } from 'mongoose';
import { transcriptIssue } from './transcript-validation';

export const DETECTION_VERSION = 'quality-discovery-v3';
export const TRANSCRIPT_VERSION = 'timestamped-transcript-v2';
export const MIN_HIGHLIGHT_SCORE = 0.7;

export function normalizeInstructions(prompt?: string): string {
  return (prompt ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

/** Explicit sorting makes identity independent of object property insertion order. */
export function artifactHash(value: unknown): string {
  const ancestors = new WeakSet<object>();
  const canonical = (input: unknown, depth = 0): unknown => {
    if (depth > 64)
      throw new TypeError('Artifact identity exceeds nesting budget');
    // Saved transcript rows are hydrated subdocuments on resume. Their enumerable
    // $__parent references are internal cycles, not part of the transcript.
    if (input instanceof Document)
      return canonical(
        input.toObject({
          getters: false,
          virtuals: false,
          transform: false,
          depopulate: true,
        }),
        depth + 1,
      );
    if (input && typeof input === 'object') {
      if (ancestors.has(input))
        throw new TypeError('Artifact identity contains a cycle');
      ancestors.add(input);
      try {
        if (Array.isArray(input))
          return input.map((item) => canonical(item, depth + 1));
        return Object.fromEntries(
          Object.entries(input)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, v]) => [key, canonical(v, depth + 1)]),
        );
      } finally {
        ancestors.delete(input);
      }
    }
    return input;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function transcriptIsValid(
  segments: unknown,
  duration: number,
): boolean {
  return !transcriptIssue(segments, duration);
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

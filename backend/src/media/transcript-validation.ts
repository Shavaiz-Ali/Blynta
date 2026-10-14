import type { TranscriptSegmentDto } from './services/transcription.service';

export type TranscriptIssue = {
  reason: string;
  segmentIndex?: number;
};

export class TranscriptValidationError extends Error {
  readonly code = 'INVALID_TRANSCRIPT_ARTIFACT';
  constructor(readonly details: TranscriptIssue) {
    super(
      `Invalid transcript artifact: ${details.reason}${details.segmentIndex === undefined ? '' : ` at segment ${details.segmentIndex}`}`,
    );
    this.name = 'TranscriptValidationError';
  }
}

/** Artifact validation is strict: persisted timestamps must already be numbers. */
export function transcriptIssue(
  value: unknown,
  duration: number,
): TranscriptIssue | undefined {
  if (!Number.isFinite(duration) || duration <= 0)
    return { reason: 'invalid_media_duration' };
  if (!Array.isArray(value)) return { reason: 'segments_not_array' };
  if (!value.length) return { reason: 'empty_transcript' };
  let previousStart = -1;
  for (let i = 0; i < value.length; i++) {
    const s = value[i] as Record<string, unknown> | null;
    let reason: string | undefined;
    if (!s || typeof s !== 'object' || Array.isArray(s))
      reason = 'invalid_segment';
    else if (typeof s.text !== 'string' || !s.text.trim())
      reason = 'empty_segment_text';
    else if (
      typeof s.startTime !== 'number' ||
      typeof s.endTime !== 'number' ||
      !Number.isFinite(s.startTime) ||
      !Number.isFinite(s.endTime)
    )
      reason = 'invalid_timestamp';
    else if (s.startTime < 0) reason = 'negative_start';
    else if (s.endTime <= s.startTime) reason = 'non_positive_segment_duration';
    else if (s.startTime < previousStart) reason = 'segments_out_of_order';
    // Preserve the existing bounded ASR end tolerance, not an unbounded acceptance.
    else if (s.endTime > duration + 30)
      reason = 'segment_exceeds_media_duration';
    if (reason) return { reason, segmentIndex: i };
    previousStart = s!.startTime as number;
  }
  return undefined;
}

export function assertTranscript(
  value: unknown,
  duration: number,
): asserts value is TranscriptSegmentDto[] {
  const issue = transcriptIssue(value, duration);
  if (issue) throw new TranscriptValidationError(issue);
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TranscriptValidationError({
      reason: 'invalid_provider_response',
    });
  return value as Record<string, unknown>;
};

function numeric(value: unknown): number {
  // Explicit decimal strings only; do not coerce null, booleans, whitespace or hex.
  return typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())
      ? Number(value)
      : NaN;
}

function timestamp(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const m = /^(\d+):([0-5]\d):([0-5]\d)[.,](\d{3})$/.exec(value);
  return m
    ? Number(m[1]) * 3600 +
        Number(m[2]) * 60 +
        Number(m[3]) +
        Number(m[4]) / 1000
    : NaN;
}

function text(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFC').replace(/\s+/gu, ' ').trim()
    : '';
}

export function normalizeTranscriptResponse(
  provider: 'groq' | 'whisper-cpp',
  value: unknown,
  duration: number,
): TranscriptSegmentDto[] {
  const response = record(value);
  const raw =
    provider === 'groq'
      ? response.segments
      : (response.transcription ?? response.segments);
  if (raw !== undefined && !Array.isArray(raw))
    throw new TranscriptValidationError({ reason: 'segments_not_array' });
  if (
    (!raw || !(raw as unknown[]).length) &&
    provider === 'groq' &&
    text(response.text)
  ) {
    // A text-only response has coarse full-audio timing; never invent a zero-length segment.
    const segments = [
      { startTime: 0, endTime: duration, text: text(response.text) },
    ];
    assertTranscript(segments, duration);
    return segments;
  }
  const segments: TranscriptSegmentDto[] = [];
  for (const [index, value] of ((raw ?? []) as unknown[]).entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new TranscriptValidationError({
        reason: 'invalid_segment',
        segmentIndex: index,
      });
    const seg = record(value);
    let startTime = numeric(seg.start),
      endTime = numeric(seg.end);
    if (provider === 'whisper-cpp' && seg.offsets !== undefined) {
      const offsets = record(seg.offsets);
      startTime = numeric(offsets.from) / 1000;
      endTime = numeric(offsets.to) / 1000;
    } else if (provider === 'whisper-cpp' && seg.timestamps !== undefined) {
      const times = record(seg.timestamps);
      startTime = timestamp(times.from);
      endTime = timestamp(times.to);
    } else if (provider === 'whisper-cpp' && seg.t0 !== undefined) {
      // whisper.cpp native t0/t1 use 10 ms ticks; JSON offsets use milliseconds.
      startTime = numeric(seg.t0) / 100;
      endTime = numeric(seg.t1) / 100;
    }
    const normalized = { startTime, endTime, text: text(seg.text) };
    // Blank provider segments represent silence only when their timing is valid.
    const timed = { ...normalized, text: normalized.text || 'silence' };
    const issue = transcriptIssue([timed], duration);
    if (issue)
      throw new TranscriptValidationError({ ...issue, segmentIndex: index });
    if (typeof seg.text !== 'string')
      throw new TranscriptValidationError({
        reason: 'invalid_segment_text',
        segmentIndex: index,
      });
    if (normalized.text) segments.push(normalized);
  }
  assertTranscript(segments, duration);
  return segments;
}

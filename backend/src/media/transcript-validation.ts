import type { TranscriptSegmentDto } from './services/transcription.service';
import { UnrecoverableError } from 'bullmq';

export type TranscriptIssue = {
  reason: string;
  segmentIndex?: number;
};

export class TranscriptValidationError extends UnrecoverableError {
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
  diagnostic?: (event: Record<string, unknown>) => void,
): TranscriptSegmentDto[] {
  if (!Number.isFinite(duration) || duration <= 0)
    throw new TranscriptValidationError({ reason: 'invalid_media_duration' });
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
  const parsed: TranscriptSegmentDto[] = [];
  const repairs: Record<string, number> = {};
  const reported = new Set<string>();
  // Only machine precision at boundaries is rounding noise; never infer speech duration.
  const epsilon = 1e-9;
  const report = (index: number, reason: string) => {
    const key = `${index}:${reason}`;
    if (reported.has(key)) return;
    reported.add(key);
    const s = parsed[index];
    const source = (raw as Record<string, unknown>[])[index];
    const safe = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;
    const rawTime = (v: unknown) => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
      if (v === undefined) return 'missing';
      if (v === null) return null;
      // Keep decimal precision evidence, but never log arbitrary provider strings.
      return typeof v === 'string' && Number.isFinite(numeric(v))
        ? v
        : `invalid_${typeof v}`;
    };
    diagnostic?.({
      event: 'transcript.segment.invalid',
      provider,
      segmentIndex: index,
      start: safe(s.startTime),
      end: safe(s.endTime),
      duration: safe(s.endTime - s.startTime),
      previousSegmentEnd: safe(parsed[index - 1]?.endTime),
      nextSegmentStart: safe(parsed[index + 1]?.startTime),
      audioDuration: duration,
      rawStart: rawTime(source.start),
      rawEnd: rawTime(source.end),
      reason,
      repairs: { ...repairs },
    });
  };
  const fail = (index: number, reason: string): never => {
    report(index, reason);
    throw new TranscriptValidationError({ reason, segmentIndex: index });
  };
  let repairedSegments = 0;
  const repairedIndices = new Set<number>();
  const repaired = (index: number, type: string) => {
    repairs[type] = (repairs[type] ?? 0) + 1;
    repairedIndices.add(index);
    repairedSegments = repairedIndices.size;
    // A bounded minority of defects can be reconciled; widespread loss of alignment cannot.
    if (
      repairedSegments >
      Math.min(20, Math.max(1, Math.floor(parsed.length * 0.05)))
    )
      fail(index, 'excessive_timestamp_repairs');
  };
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
    if (typeof seg.text !== 'string')
      throw new TranscriptValidationError({
        reason: 'invalid_segment_text',
        segmentIndex: index,
      });
    parsed.push({ startTime, endTime, text: text(seg.text) });
  }
  // Validate chronology before any merges. Never sort a corrupt provider response.
  for (const [index, s] of parsed.entries()) {
    const issue = transcriptIssue(
      [{ ...s, text: s.text || 'silence' }],
      duration,
    );
    if (issue) report(index, issue.reason);
    if (!Number.isFinite(s.startTime) || !Number.isFinite(s.endTime))
      fail(index, 'invalid_timestamp');
    let adjusted = false;
    if (s.startTime < 0 && s.startTime >= -epsilon) {
      s.startTime = 0;
      adjusted = true;
    }
    if (s.endTime > duration && s.endTime <= duration + epsilon) {
      s.endTime = duration;
      adjusted = true;
    }
    if (s.startTime < 0 || s.endTime < 0) fail(index, 'negative_start');
    if (s.startTime > duration || s.endTime > duration)
      fail(index, 'segment_exceeds_media_duration');
    if (index && s.startTime < parsed[index - 1].startTime)
      fail(index, 'segments_out_of_order');
    if (s.endTime < s.startTime - epsilon)
      fail(index, 'non_positive_segment_duration');
    if (adjusted) repaired(index, 'boundary_precision');
  }
  for (const [index, s] of parsed.entries()) {
    if (s.endTime <= s.startTime) {
      // Retain every word only inside an already timed, adjacent speech interval.
      // A zero point must touch its neighbor, not lie somewhere in an untimed gap.
      const previous = segments[segments.length - 1];
      const next = parsed[index + 1];
      if (previous && Math.abs(previous.endTime - s.startTime) <= epsilon) {
        if (s.text) previous.text += ` ${s.text}`;
      } else if (
        next &&
        next.text &&
        next.endTime > next.startTime &&
        Math.abs(next.startTime - s.startTime) <= epsilon
      ) {
        next.text = [s.text, next.text].filter(Boolean).join(' ');
      } else fail(index, 'non_positive_segment_duration');
      repaired(index, 'merge_zero_duration');
    } else if (s.text) segments.push({ ...s });
  }
  assertTranscript(segments, duration);
  if (repairedSegments)
    diagnostic?.({
      event: 'transcript.normalized',
      provider,
      repairedSegments,
      repairs,
      inputSegments: parsed.length,
      outputSegments: segments.length,
    });
  return segments;
}

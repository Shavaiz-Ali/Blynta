import { Job as BullJob, UnrecoverableError } from 'bullmq';
import observedTimings from './fixtures/groq-zero-duration-timestamps.json';
import {
  assertTranscript,
  normalizeTranscriptResponse,
  TranscriptValidationError,
} from './transcript-validation';

const normalize = (
  segments: unknown[],
  duration = 10,
  diagnostic?: (event: Record<string, unknown>) => void,
) => normalizeTranscriptResponse('groq', { segments }, duration, diagnostic);

describe('conservative timestamp repair', () => {
  test.each(observedTimings)(
    'repairs observed raw Groq timing at index $rawIndex with synthetic text',
    ({ previous, point, next }) => {
      // Only observed timestamp neighborhoods are retained; all spoken text is synthetic.
      const raw = [
        { start: previous[0], end: previous[1], text: 'previous' },
        { start: point, end: point, text: 'zero' },
        { start: next[0], end: next[1], text: 'next' },
      ];
      const output = normalize(raw, 4860.8735);
      assertTranscript(output, 4860.8735);
      expect(output.map((s) => s.text).join(' ')).toBe('previous zero next');
      expect(output.map((s) => [s.startTime, s.endTime])).toEqual([
        previous,
        next,
      ]);
    },
  );
  test('installed BullMQ skips automatic retries for corrupt transcripts and retains backoff for infrastructure errors', async () => {
    const decision = (
      BullJob.prototype as unknown as {
        shouldRetryJob: (error: Error) => Promise<[boolean, number]>;
      }
    ).shouldRetryJob;
    const job = {
      attemptsMade: 0,
      discarded: false,
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      queue: { opts: {} },
    };
    expect(
      await decision.call(
        job,
        new TranscriptValidationError({
          reason: 'non_positive_segment_duration',
          segmentIndex: 345,
        }),
      ),
    ).toEqual([false, 0]);
    expect(
      await decision.call(job, new Error('temporary cache outage')),
    ).toEqual([true, 2000]);
  });
  test('preserves higher precision, positive durations and existing overlaps unchanged', () => {
    const raw = [
      { start: 0.123456789, end: 1.000000001, text: 'one' },
      { start: 1, end: 1.0000000001, text: 'two' },
    ];
    expect(normalize(raw)).toEqual(
      raw.map((s) => ({ startTime: s.start, endTime: s.end, text: s.text })),
    );
  });
  test.each(['previous', 'next'])(
    'retains zero-duration speech at the %s boundary without extending intervals',
    (neighbor) => {
      const raw =
        neighbor === 'previous'
          ? [
              { start: 0, end: 1, text: 'one' },
              { start: 1, end: 1, text: 'two' },
            ]
          : [
              { start: 0, end: 0, text: 'one' },
              { start: 0, end: 1, text: 'two' },
            ];
      expect(normalize(raw)).toEqual([
        { startTime: 0, endTime: 1, text: 'one two' },
      ]);
      expect(raw.map((s) => s.text)).toEqual(['one', 'two']);
    },
  );
  test('corrects machine precision at audio bounds', () => {
    expect(
      normalize([{ start: -1e-12, end: 10 + 1e-12, text: 'one' }]),
    ).toEqual([{ startTime: 0, endTime: 10, text: 'one' }]);
  });
  test('merges a reversed interval only within machine precision at a known boundary', () => {
    expect(
      normalize([
        { start: 0, end: 1, text: 'one' },
        { start: 1, end: 1 - 1e-12, text: 'two' },
      ]),
    ).toEqual([{ startTime: 0, endTime: 1, text: 'one two' }]);
  });
  test('preserves duplicate positive intervals according to the existing overlap contract', () => {
    expect(
      normalize([
        { start: 0, end: 1, text: 'one' },
        { start: 0, end: 1, text: 'two' },
      ]),
    ).toHaveLength(2);
  });
  test.each([
    [
      { start: 1, end: 1, text: 'private speech' },
      'non_positive_segment_duration',
    ],
    [
      { start: 2, end: 1, text: 'private speech' },
      'non_positive_segment_duration',
    ],
    [{ end: 1, text: 'private speech' }, 'invalid_timestamp'],
    [{ start: NaN, end: 1, text: 'private speech' }, 'invalid_timestamp'],
    [{ start: 0, end: Infinity, text: 'private speech' }, 'invalid_timestamp'],
    [{ start: -0.01, end: 1, text: 'private speech' }, 'negative_start'],
    [
      { start: 0, end: 10.01, text: 'private speech' },
      'segment_exceeds_media_duration',
    ],
  ])(
    'rejects unsafe timestamps with private-content-free diagnostics',
    (segment, reason) => {
      const diagnostic = jest.fn();
      expect(() => normalize([segment], 10, diagnostic)).toThrow(
        String(reason),
      );
      expect(diagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'transcript.segment.invalid',
          segmentIndex: 0,
          reason,
          provider: 'groq',
          audioDuration: 10,
        }),
      );
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(
        'private speech',
      );
      try {
        normalize([segment]);
      } catch (error) {
        expect(error).toBeInstanceOf(UnrecoverableError);
      }
    },
  );
  test('does not move isolated point speech across a silence gap', () => {
    expect(() =>
      normalize([
        { start: 0, end: 1, text: 'one' },
        { start: 2, end: 2, text: 'two' },
        { start: 3, end: 4, text: 'three' },
      ]),
    ).toThrow('non_positive_segment_duration');
  });
  test('checks ordering before merging', () => {
    expect(() =>
      normalize([
        { start: 2, end: 3, text: 'one' },
        { start: 1, end: 1, text: 'two' },
      ]),
    ).toThrow('segments_out_of_order');
  });
  test('rejects substantially corrupted alignment even when all text could be merged', () => {
    expect(() =>
      normalize([
        { start: 0, end: 1, text: 'one' },
        { start: 1, end: 1, text: 'two' },
        { start: 1, end: 1, text: 'three' },
      ]),
    ).toThrow('excessive_timestamp_repairs');
  });
  test.each([101, 345, 466])(
    '81-minute synthetic regression at segment %i',
    (index) => {
      // Synthetic timestamps only; no production transcript content is retained.
      const raw = Array.from({ length: 480 }, (_, i) => ({
        start: i * 10,
        end: i * 10 + 9,
        text: `word${i}`,
      }));
      raw[index].start = raw[index].end = raw[index - 1].end;
      const diagnostic = jest.fn();
      const output = normalize(raw, 4860.881, diagnostic);
      assertTranscript(output, 4860.881);
      expect(output.map((s) => s.text).join(' ')).toBe(
        raw.map((s) => s.text).join(' '),
      );
      expect(output).toHaveLength(479);
      expect(diagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'transcript.segment.invalid',
          segmentIndex: index,
          rawStart: raw[index].start,
          rawEnd: raw[index].end,
          previousSegmentEnd: raw[index - 1].end,
          nextSegmentStart: raw[index + 1].start,
        }),
      );
      expect(diagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'transcript.normalized',
          repairedSegments: 1,
          repairs: { merge_zero_duration: 1 },
        }),
      );
      expect(diagnostic).toHaveBeenCalledTimes(2);
    },
  );
});

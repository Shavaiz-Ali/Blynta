import {
  normalizeTranscriptResponse,
  assertTranscript,
  transcriptIssue,
} from './transcript-validation';

describe('transcription response and artifact validation', () => {
  test('normalizes numeric provider timestamps and Unicode whitespace', () => {
    expect(
      normalizeTranscriptResponse(
        'groq',
        { segments: [{ start: '0.5', end: '2', text: ' Hello\n world ' }] },
        10,
      ),
    ).toEqual([{ startTime: 0.5, endTime: 2, text: 'Hello world' }]);
  });
  test('text-only Groq output uses verified audio duration instead of zero length', () => {
    expect(
      normalizeTranscriptResponse('groq', { text: ' hello ', segments: [] }, 4),
    ).toEqual([{ startTime: 0, endTime: 4, text: 'hello' }]);
    expect(() =>
      normalizeTranscriptResponse('groq', { text: 'hello' }, 0),
    ).toThrow('invalid_media_duration');
  });
  test.each([{}, { text: '' }, { segments: [] }])(
    'rejects empty transcription (%j)',
    (response) => {
      expect(() => normalizeTranscriptResponse('groq', response, 10)).toThrow(
        'empty_transcript',
      );
    },
  );
  test.each([
    [null, 'invalid_segment'],
    [
      { startTime: 0, endTime: 0, text: 'private content' },
      'non_positive_segment_duration',
    ],
    [
      { startTime: 3, endTime: 2, text: 'private content' },
      'non_positive_segment_duration',
    ],
    [{ startTime: -1, endTime: 2, text: 'private content' }, 'negative_start'],
    [
      { startTime: NaN, endTime: 2, text: 'private content' },
      'invalid_timestamp',
    ],
    [
      { startTime: '0', endTime: 2, text: 'private content' },
      'invalid_timestamp',
    ],
    [
      { startTime: 0, endTime: 100, text: 'private content' },
      'segment_exceeds_media_duration',
    ],
  ])(
    'rejects malformed persisted segments without leaking text',
    (segment, reason) => {
      expect(transcriptIssue([segment], 10)).toEqual({
        reason,
        segmentIndex: 0,
      });
      expect(() => assertTranscript([segment], 10)).toThrow(reason);
      try {
        assertTranscript([segment], 10);
      } catch (error) {
        expect(String(error)).not.toContain('private content');
      }
    },
  );
  test('rejects malformed provider segments even when full text exists', () => {
    expect(() =>
      normalizeTranscriptResponse(
        'groq',
        { text: 'fallback', segments: [{ start: 0, end: 0, text: 'bad' }] },
        10,
      ),
    ).toThrow('non_positive_segment_duration');
    expect(() =>
      normalizeTranscriptResponse('groq', { segments: {} }, 10),
    ).toThrow('segments_not_array');
  });
  test('omits valid silence intervals but rejects all-silence transcription', () => {
    expect(
      normalizeTranscriptResponse(
        'groq',
        {
          segments: [
            { start: 0, end: 1, text: ' ' },
            { start: 1, end: 2, text: 'speech' },
          ],
        },
        10,
      ),
    ).toHaveLength(1);
    expect(() =>
      normalizeTranscriptResponse(
        'groq',
        { segments: [{ start: 0, end: 1, text: ' ' }] },
        10,
      ),
    ).toThrow('empty_transcript');
  });
  test('rejects reversed chronology and nonnumeric coercions', () => {
    expect(() =>
      normalizeTranscriptResponse(
        'groq',
        {
          segments: [
            { start: 2, end: 3, text: 'a' },
            { start: 0, end: 1, text: 'b' },
          ],
        },
        10,
      ),
    ).toThrow('segments_out_of_order');
    for (const start of [null, false, '', '0x10', 'NaN'])
      expect(() =>
        normalizeTranscriptResponse(
          'groq',
          { segments: [{ start, end: 1, text: 'a' }] },
          10,
        ),
      ).toThrow('invalid_timestamp');
  });
  test.each([
    { offsets: { from: 1000, to: 2500 } },
    { timestamps: { from: '00:00:01.000', to: '00:00:02,500' } },
    { t0: 100, t1: 250 },
    { start: 1, end: 2.5 },
  ])('normalizes whisper.cpp timing formats (%j)', (times) => {
    expect(
      normalizeTranscriptResponse(
        'whisper-cpp',
        { transcription: [{ ...times, text: 'speech' }] },
        10,
      ),
    ).toEqual([{ startTime: 1, endTime: 2.5, text: 'speech' }]);
  });
});

import { CaptionBurningService } from './caption-burning.service';
import { STYLE_PRESETS } from '../style-presets';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import * as fs from 'fs';
import { normalizeTranscriptResponse } from '../transcript-validation';
jest.mock('../utils/run-command-with-progress', () => ({
  runCommandWithProgress: jest.fn(),
}));
const run = jest.mocked(runCommandWithProgress);
describe('caption Unicode and render safeguards', () => {
  const service = new CaptionBurningService({} as never);
  afterEach(() => jest.restoreAllMocks());
  test('repaired boundary speech burns within the original timed interval', () => {
    const segments = normalizeTranscriptResponse(
      'groq',
      {
        segments: [
          { start: 0, end: 2, text: 'Synthetic' },
          { start: 2, end: 2, text: 'speech' },
        ],
      },
      10,
    );
    const ass = (
      service as unknown as {
        buildAss: (
          segments: ReturnType<typeof normalizeTranscriptResponse>,
          style: typeof STYLE_PRESETS.default.captionStyle,
        ) => string;
      }
    ).buildAss(segments, STYLE_PRESETS.default.captionStyle);
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:02.00,');
    expect(ass.replace(/\{[^}]*\}/g, '')).toContain('Synthetic speech');
  });
  test.each([
    'Readable English — café',
    'یہ اردو ہے',
    'यह हिंदी है',
    'English और हिंदी',
    'English اور اردو',
  ])('preserves UTF-8 text %s in canonical ASS', (text) => {
    const ass = (service as any).buildAss(
      [{ startTime: 0, endTime: 2, text }],
      STYLE_PRESETS.default.captionStyle,
    );
    expect(ass.replace(/\{[^}]*\}/g, '')).toContain(text);
    expect(ass).toContain('MarginL, MarginR, MarginV');
    expect(ass).toContain('WrapStyle: 0');
    expect(ass).toContain('Default,,0,0,0,,');
  });
  test('does not publish a zero-exit render with terminal missing glyph warnings', async () => {
    run.mockImplementationOnce(async (_command, _args, onLine) => {
      onLine('fontselect: failed to find any fallback with glyph 0x6C1');
    });
    const unlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
    await expect(
      (service as any).burnWithFfmpeg('in.mp4', 'caption.ass', 'out.mp4', 1),
    ).rejects.toThrow('missing glyphs');
    expect(unlink).toHaveBeenCalledWith('out.mp4');
  });
  test('normal glyph fallback is accepted when another font is found', async () => {
    run.mockImplementationOnce(async (_command, _args, onLine) => {
      onLine('Glyph 0x939 not found, selecting one more font');
      onLine('fontselect: Noto Sans Devanagari');
    });
    await expect(
      (service as any).burnWithFfmpeg('in.mp4', 'caption.ass', 'out.mp4', 1),
    ).resolves.toBeUndefined();
  });
});

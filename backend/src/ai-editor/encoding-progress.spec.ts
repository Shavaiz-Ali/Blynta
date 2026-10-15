import { encodingProgress } from './encoding-progress';
describe('FFmpeg encoding progress', () => {
  it.each([
    'out_time_us=6400000',
    'out_time_ms=6400000',
    'out_time=00:00:06.400000',
  ])('parses %s against output duration', (line) => {
    expect(encodingProgress(line, 10)).toBe(64);
  });
  it.each([
    'out_time_us=N/A',
    'out_time_us=-1',
    'out_time=00:70:00',
    'speed=2.0x',
    'progress=end',
  ])('ignores invalid or non-time fields %s', (line) => {
    expect(encodingProgress(line, 10)).toBeUndefined();
  });
  it('reserves completion for verified uploaded media', () => {
    expect(encodingProgress('out_time_us=20000000', 10)).toBe(99);
    expect(encodingProgress('out_time_us=100', 0)).toBeUndefined();
    expect(encodingProgress('out_time_us=100', NaN)).toBeUndefined();
  });
});

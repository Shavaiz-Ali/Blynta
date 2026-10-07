import { ffmpegProgressParser } from './ffmpeg-progress';

describe('machine-readable FFmpeg progress', () => {
  it('uses microseconds and speed to calculate real progress and ETA', () => {
    const publish = jest.fn<
      void,
      [import('./ffmpeg-progress').FfmpegProgress]
    >();
    const line = ffmpegProgressParser(47, publish);
    [
      'frame=930',
      'fps=30.0',
      'out_time_us=31000000',
      'speed=1.1x',
      'progress=continue',
    ].forEach(line);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        processedSeconds: 31,
        progress: (31 / 47) * 100,
        speed: 1.1,
        etaSeconds: 16 / 1.1,
        frame: 930,
        fps: 30,
      }),
    );
  });
  it('clamps overrun and omits unavailable ETA', () => {
    const publish = jest.fn<
      void,
      [import('./ffmpeg-progress').FfmpegProgress]
    >();
    const line = ffmpegProgressParser(10, publish);
    ['out_time_us=12000000', 'speed=N/A', 'progress=end'].forEach(line);
    expect(publish.mock.calls[0][0]).toMatchObject({
      progress: 100,
      processedSeconds: 10,
      etaSeconds: undefined,
    });
  });
  it('ignores diagnostics, invalid timestamps, and unstable early speed', () => {
    const publish = jest.fn<
      void,
      [import('./ffmpeg-progress').FfmpegProgress]
    >();
    const line = ffmpegProgressParser(10, publish);
    ['frame=    5 fps=23', 'out_time_us=N/A', 'progress=continue'].forEach(
      line,
    );
    expect(publish).not.toHaveBeenCalled();
    ['out_time_us=100000', 'speed=5x', 'progress=continue'].forEach(line);
    expect(publish.mock.calls[0][0]).toMatchObject({
      progress: 1,
      speed: undefined,
      etaSeconds: undefined,
    });
  });
});

import { hostCommand } from './host-command';

describe('host command capacity', () => {
  afterEach(() => {
    delete process.env.MEDIA_HOST_CONCURRENCY;
    delete process.env.FFMPEG_THREADS;
    delete process.env.MEDIA_COMMAND_TIMEOUT_SECONDS;
  });
  function payload(
    command: string,
    args: string[],
  ): { slots: number; args: string[] } {
    const result = hostCommand(command, args);
    if (result.env)
      return JSON.parse(
        Buffer.from(result.env.BLYNTA_GATE_PAYLOAD, 'base64').toString(),
      ) as { slots: number; args: string[] };
    return { slots: Number(result.args[4]), args: result.args.slice(7) };
  }
  it('defaults to one host slot and caps decoder, filters and encoder', () => {
    const result = payload('ffmpeg', ['-i', 'source.mp4', '-y', 'clip.mp4']);
    expect(result.slots).toBe(1);
    expect(result.args.slice(0, 6)).toEqual([
      '-threads',
      '1',
      '-filter_threads',
      '1',
      '-filter_complex_threads',
      '1',
    ]);
    expect(result.args.slice(-3)).toEqual(['-threads', '1', 'clip.mp4']);
  });
  it('coordinates yt-dlp postprocessing and local transcription with the same slots', () => {
    process.env.MEDIA_HOST_CONCURRENCY = '2';
    expect(payload('yt-dlp', ['url']).slots).toBe(2);
    expect(payload('whisper-cli', ['-m', 'model']).slots).toBe(2);
  });
  it.each(['0', '9', 'garbage', '1.5'])(
    'rejects invalid host capacity %s before spawning',
    (value) => {
      process.env.MEDIA_HOST_CONCURRENCY = value;
      expect(() => hostCommand('ffmpeg', [])).toThrow('MEDIA_HOST_CONCURRENCY');
    },
  );
  it('rejects an unbounded command deadline', () => {
    process.env.MEDIA_COMMAND_TIMEOUT_SECONDS = '0';
    expect(() => hostCommand('ffmpeg', [])).toThrow(
      'MEDIA_COMMAND_TIMEOUT_SECONDS',
    );
  });
});

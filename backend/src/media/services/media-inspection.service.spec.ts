import {
  normalizeMediaMetadata,
  estimateVideoWorkload,
} from './media-inspection.service';

describe('source metadata and workload', () => {
  it('normalizes rational FPS and separates audio metadata', () => {
    expect(
      normalizeMediaMetadata({
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            avg_frame_rate: '30000/1001',
            codec_name: 'h264',
          },
          { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000' },
        ],
        format: { duration: '5420', size: '3200000000', bit_rate: '5000000' },
      }),
    ).toEqual({
      durationSeconds: 5420,
      width: 1920,
      height: 1080,
      fps: 30000 / 1001,
      codec: 'h264',
      bitrate: 5000000,
      fileSizeBytes: 3200000000,
      audioCodec: 'aac',
      sampleRate: 48000,
      hasVideo: true,
      hasAudio: true,
    });
  });
  it('does not treat attached artwork as video or divide by zero FPS', () => {
    const metadata = normalizeMediaMetadata({
      streams: [
        { codec_type: 'video', disposition: { attached_pic: 1 } },
        { codec_type: 'audio' },
      ],
    });
    expect(metadata).toMatchObject({
      hasVideo: false,
      hasAudio: true,
      durationSeconds: 0,
      fps: undefined,
    });
  });
  it('weights duration, pixels, FPS, codec and operations rather than file size', () => {
    const baseline = normalizeMediaMetadata({
      streams: [
        {
          codec_type: 'video',
          width: 1920,
          height: 1080,
          avg_frame_rate: '30/1',
        },
      ],
      format: { duration: '600' },
    });
    const base = estimateVideoWorkload(baseline).score;
    expect(
      estimateVideoWorkload({ ...baseline, fileSizeBytes: 10 ** 12 }).score,
    ).toBe(base);
    expect(
      estimateVideoWorkload({ ...baseline, durationSeconds: 1200 }).score,
    ).toBe(base * 2);
    expect(
      estimateVideoWorkload({
        ...baseline,
        width: 3840,
        height: 2160,
        fps: 60,
        codec: 'av1',
      }).score,
    ).toBeGreaterThan(base * 8);
    expect(
      estimateVideoWorkload(baseline, { captions: false, crop: false }).score,
    ).toBeLessThan(base);
  });
});

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { examplePlan } from './edit-plan.fixture';
import { parseEdit, planSchema } from './edit-plan.contract';
import { buildRenderSpec } from './ffmpeg-edit-renderer';
import { mergeEditPatch } from './agent/edit-patch';
const exec = promisify(execFile);
const ffmpeg = process.env.EDIT_FFMPEG_PATH;
const ffprobe = process.env.EDIT_FFPROBE_PATH;
// Explicit opt-in; CI should supply both paths. Never replace actual renders with mocks.
const integration = ffmpeg && ffprobe ? describe : describe.skip;
integration('FFmpeg editing media integration', () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'blynta-edit-integration-'));
  }, 30000);
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it('normalizes a silent portrait VFR source to the requested CFR timeline', async () => {
    const source = join(directory, 'vfr.mp4');
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=180x320:rate=30:duration=2',
      '-vf',
      "select='if(lt(t,1),not(mod(n,3)),1)'",
      '-fps_mode',
      'vfr',
      '-threads',
      '1',
      '-c:v',
      'libx264',
      source,
    ]);
    const p = examplePlan();
    p.video.aspectRatio = 'preserve';
    p.video.segments = [
      { id: 'vfr', type: 'video', sourceStart: 0, sourceEnd: 2, crossfade: 0 },
    ];
    const spec = buildRenderSpec(
      p,
      { path: source, hasAudio: false, duration: 2, width: 180, height: 320 },
      new Map(),
      directory,
      {
        fontFiles: {
          sans:
            process.env.EDIT_FONT_SANS ||
            (process.platform === 'win32'
              ? 'C:/Windows/Fonts/arial.ttf'
              : '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'),
        },
      },
    );
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    await exec(
      ffmpeg!,
      ['-filter_complex_threads', '1', '-threads', '1', ...spec.args],
      { timeout: 60000 },
    );
    const { stdout } = await exec(ffprobe!, [
      '-v',
      'error',
      '-count_frames',
      '-show_streams',
      '-of',
      'json',
      join(directory, 'output.mp4'),
    ]);
    const result = JSON.parse(stdout) as {
      streams: {
        codec_type: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
        nb_read_frames?: string;
      }[];
    };
    const video = result.streams.find((s) => s.codec_type === 'video')!;
    expect(video.width).toBe(720);
    expect(video.height).toBe(1280);
    expect(video.avg_frame_rate).toBe('30/1');
    expect(Number(video.nb_read_frames)).toBe(60);
    expect(result.streams.some((s) => s.codec_type === 'audio')).toBe(true);
  }, 90000);
  it('renders an approved AI patch using the original Phase 1 compiler', async () => {
    const source = join(directory, 'ai-source.mp4');
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=30:duration=3',
      '-threads',
      '1',
      '-c:v',
      'libx264',
      source,
    ]);
    const original = examplePlan();
    const merged = mergeEditPatch(original, 1, {
      baseRevision: 1,
      changes: [
        {
          action: 'add',
          operation: {
            id: 'ai-zoom',
            type: 'zoom',
            start: 0.5,
            end: 2,
            params: {
              fromScale: 1,
              toScale: 1.25,
              focusX: 0.5,
              focusY: 0.5,
              easing: 'linear',
            },
          },
        },
      ],
    }).plan;
    const spec = buildRenderSpec(
      merged,
      { path: source, hasAudio: false, duration: 3, width: 320, height: 180 },
      new Map(),
      directory,
    );
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    await exec(ffmpeg!, ['-filter_complex_threads', '1', ...spec.args], {
      timeout: 60000,
      maxBuffer: 2000000,
    });
    const { stdout } = await exec(ffprobe!, [
      '-v',
      'error',
      '-show_streams',
      '-of',
      'json',
      join(directory, 'output.mp4'),
    ]);
    const result = JSON.parse(stdout) as {
      streams: {
        codec_type: string;
        width?: number;
        height?: number;
        duration?: string;
      }[];
    };
    expect(result.streams.find((s) => s.codec_type === 'video')).toMatchObject({
      width: 1280,
      height: 720,
    });
    expect(
      Number(result.streams.find((s) => s.codec_type === 'video')?.duration),
    ).toBeCloseTo(3, 1);
    expect(result.streams.some((s) => s.codec_type === 'audio')).toBe(true);
    expect(original.operations).toEqual([]);
  }, 90000);
  it('renders trims, a silent freeze, crossfade, all overlays, reframing and mixed audio', async () => {
    const source = join(directory, 'source.mp4'),
      music = join(directory, 'music.wav'),
      png = join(directory, 'emoji.png');
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=30:duration=4',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100:duration=4',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      source,
    ]);
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:sample_rate=32000:duration=4',
      music,
    ]);
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:size=64x64',
      '-frames:v',
      '1',
      png,
    ]);
    const p = parseEdit(planSchema, {
      ...examplePlan(),
      video: {
        aspectRatio: '16:9',
        segments: [
          { id: 'a', type: 'video', sourceStart: 0, sourceEnd: 1 },
          {
            id: 'f',
            type: 'freeze_frame',
            sourceTime: 1,
            duration: 0.5,
            audio: 'silence',
          },
          { id: 'b', type: 'video', sourceStart: 1, sourceEnd: 2.5 },
          {
            id: 'c',
            type: 'video',
            sourceStart: 2.5,
            sourceEnd: 4,
            crossfade: 0.2,
          },
        ],
      },
      audio: {
        original: {
          automation: [
            { time: 0, gain: 1 },
            { time: 1, gain: 0 },
            { time: 2, gain: 1 },
          ],
          mutes: [{ start: 1, end: 1.5 }],
        },
        tracks: ['music_track', 'sound_effect', 'voiceover'].map((role, i) => ({
          id: `a${i}`,
          role,
          assetId: 'music',
          start: i * 0.5,
          sourceStart: 0,
          sourceEnd: 2,
          gain: 0.1,
          fadeIn: 0.1,
          fadeOut: 0.1,
        })),
      },
      operations: [
        {
          id: 'z',
          type: 'zoom',
          start: 0,
          end: 1,
          params: {
            fromScale: 1,
            toScale: 1.5,
            focusX: 0.5,
            focusY: 0.4,
            easing: 'easeInOut',
          },
        },
        {
          id: 'c',
          type: 'crop',
          start: 2,
          end: 3,
          params: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        },
        {
          id: 'zoom-out',
          type: 'zoom',
          start: 1.5,
          end: 2,
          params: { fromScale: 1.5, toScale: 1, focusX: 0.5, focusY: 0.5 },
        },
        {
          id: 'static-zoom',
          type: 'zoom',
          start: 3,
          end: 3.5,
          params: { fromScale: 1.2, toScale: 1.2, focusX: 0.5, focusY: 0.5 },
        },
        {
          id: 't',
          type: 'text_overlay',
          start: 0,
          end: 2,
          params: {
            text: "Safe ':;[text] %{metadata}\nSecond line",
            x: 0.5,
            y: 0.8,
            fontSize: 32,
            color: '#ffffff',
          },
        },
        {
          id: 'i',
          type: 'image_overlay',
          start: 0,
          end: 1,
          params: {
            assetId: 'png',
            x: 0.1,
            y: 0.1,
            width: 0.1,
            opacity: 0.5,
            fadeIn: 0.1,
            fadeOut: 0.1,
          },
        },
        {
          id: 'e',
          type: 'emoji_overlay',
          start: 1,
          end: 2,
          params: { assetId: 'png', emoji: '😀', x: 0.9, y: 0.1, width: 0.1 },
        },
        {
          id: 'in',
          type: 'transition',
          start: 0,
          end: 0.1,
          params: { kind: 'fade_in' },
        },
        {
          id: 'out',
          type: 'transition',
          start: 4.2,
          end: 4.3,
          params: { kind: 'fade_out' },
        },
      ],
      captions: [
        {
          id: 'en',
          language: 'en',
          script: 'Latn',
          visible: true,
          burnIn: true,
          style: { font: 'sans', fontSize: 24, color: '#ffffff' },
          cues: [{ start: 2, end: 3, text: 'Caption' }],
        },
      ],
    });
    const spec = buildRenderSpec(
      p,
      { path: source, duration: 4, hasAudio: true, width: 320, height: 180 },
      new Map([
        ['music', { path: music, duration: 4, hasAudio: true }],
        ['png', { path: png, duration: 0, hasAudio: false }],
      ]),
      directory,
      {
        fontFiles: {
          sans:
            process.env.EDIT_FONT_SANS ||
            (process.platform === 'win32'
              ? 'C:/Windows/Fonts/arial.ttf'
              : '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'),
        },
      },
    );
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    for (const file of spec.textFiles) await writeFile(file.path, file.text);
    await exec(ffmpeg!, ['-filter_complex_threads', '1', ...spec.args], {
      timeout: 60000,
      maxBuffer: 2_000_000,
    });
    const { stdout } = await exec(ffprobe!, [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      join(directory, 'output.mp4'),
    ]);
    const probe = JSON.parse(stdout) as {
      format: { duration: string };
      streams: { codec_type: string; width: number; height: number }[];
    };
    expect(Number(probe.format.duration)).toBeCloseTo(4.3, 1);
    expect(probe.streams.find((s) => s.codec_type === 'video')).toMatchObject({
      width: 1280,
      height: 720,
    });
    expect(probe.streams.some((s) => s.codec_type === 'audio')).toBe(true);
    expect(
      (await readFile(join(directory, 'output.mp4'))).length,
    ).toBeGreaterThan(1000);
  }, 90000);
  it('renders video without source audio and keeps freeze duration exact', async () => {
    const source = join(directory, 'silent.mp4');
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=24:duration=2',
      '-c:v',
      'libx264',
      source,
    ]);
    const p = examplePlan();
    p.video.fps = 24;
    p.video.segments = [
      {
        id: 'f',
        type: 'freeze_frame',
        sourceTime: 1,
        duration: 1,
        audio: 'silence',
        crossfade: 0,
      },
    ];
    const spec = buildRenderSpec(
      p,
      { path: source, duration: 2, hasAudio: false, width: 320, height: 180 },
      new Map(),
      directory,
    );
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    await exec(ffmpeg!, ['-filter_complex_threads', '1', ...spec.args], {
      timeout: 60000,
    });
    const { stdout } = await exec(ffprobe!, [
      '-v',
      'error',
      '-show_format',
      '-of',
      'json',
      join(directory, 'output.mp4'),
    ]);
    expect(
      Number(
        (JSON.parse(stdout) as { format: { duration: string } }).format
          .duration,
      ),
    ).toBeCloseTo(1, 1);
  }, 90000);
  it('keeps speech, music automation and a delayed sound effect synchronized without clipping', async () => {
    const source = join(directory, 'speech.mp4'),
      music = join(directory, 'background.wav'),
      effect = join(directory, 'effect.wav');
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:size=160x90:rate=30:duration=10',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=48000:duration=10',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      source,
    ]);
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:sample_rate=44100:duration=10',
      music,
    ]);
    await exec(ffmpeg!, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1760:sample_rate=32000:duration=0.3',
      effect,
    ]);
    const p = parseEdit(planSchema, {
      ...examplePlan(),
      video: {
        aspectRatio: '16:9',
        segments: [
          { id: 'main', type: 'video', sourceStart: 0, sourceEnd: 10 },
        ],
      },
      audio: {
        original: {
          automation: [
            { time: 0, gain: 1 },
            { time: 5, gain: 1 },
            { time: 6, gain: 0 },
            { time: 8, gain: 0 },
            { time: 9, gain: 1 },
          ],
        },
        tracks: [
          {
            id: 'music',
            role: 'music_track',
            assetId: 'music',
            start: 0,
            sourceStart: 0,
            sourceEnd: 10,
            automation: [
              { time: 0, gain: 0.1 },
              { time: 6, gain: 0.1 },
              { time: 7.5, gain: 0.6 },
              { time: 8, gain: 0.1 },
            ],
          },
          {
            id: 'effect',
            role: 'sound_effect',
            assetId: 'effect',
            start: 7,
            sourceStart: 0,
            sourceEnd: 0.3,
            gain: 0.5,
          },
        ],
      },
    });
    const spec = buildRenderSpec(
      p,
      { path: source, duration: 10, hasAudio: true, width: 160, height: 90 },
      new Map([
        ['music', { path: music, duration: 10, hasAudio: true }],
        ['effect', { path: effect, duration: 0.3, hasAudio: true }],
      ]),
      directory,
    );
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    await exec(ffmpeg!, ['-filter_complex_threads', '1', ...spec.args], {
      timeout: 60000,
    });
    const { stdout } = await exec(
      ffmpeg!,
      [
        '-v',
        'error',
        '-i',
        join(directory, 'output.mp4'),
        '-vn',
        '-ac',
        '1',
        '-ar',
        '48000',
        '-f',
        'f32le',
        'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 3_000_000 },
    );
    const samples = Array.from({ length: stdout.length / 4 }, (_, i) =>
      stdout.readFloatLE(i * 4),
    );
    const amplitude = (frequency: number, time: number) => {
      const start = Math.round(time * 48000),
        count = 4800;
      let real = 0,
        imaginary = 0;
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * frequency * i) / 48000;
        real += samples[start + i] * Math.cos(angle);
        imaginary += samples[start + i] * Math.sin(angle);
      }
      return (2 * Math.hypot(real, imaginary)) / count;
    };
    expect(amplitude(440, 2)).toBeGreaterThan(0.08);
    expect(amplitude(440, 6.5)).toBeLessThan(0.002);
    expect(amplitude(440, 9)).toBeGreaterThan(0.08);
    expect(amplitude(880, 7.3)).toBeGreaterThan(amplitude(880, 2) * 3);
    expect(amplitude(880, 8.5)).toBeLessThan(amplitude(880, 7.3) / 3);
    expect(amplitude(1760, 7.05)).toBeGreaterThan(0.03);
    expect(amplitude(1760, 6.5)).toBeLessThan(0.002);
    expect(
      samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0),
    ).toBeLessThan(1);
    expect(samples.length / 48000).toBeCloseTo(10, 1);
  }, 90000);
});

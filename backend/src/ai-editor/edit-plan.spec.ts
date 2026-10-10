import { BadRequestException } from '@nestjs/common';
import { examplePlan } from './edit-plan.fixture';
import { planSchema, parseEdit } from './edit-plan.contract';
import { compileTimeline, sourceToOutput } from './timeline';
import { buildRenderSpec, previewText } from './ffmpeg-edit-renderer';
import { editView } from './edit-admission.service';
import { gainExpression } from './audio-effects';

describe('EditPlan validation and deterministic compilation', () => {
  it('rejects invalid source metadata and tolerates arithmetic noise at the exact boundary', () => {
    const p = examplePlan();
    expect(() => compileTimeline(p, Infinity)).toThrow('timeline validation');
    p.video.segments = [
      {
        id: 'main',
        type: 'video',
        sourceStart: 0,
        sourceEnd: 0.3,
        crossfade: 0,
      },
    ];
    p.operations = [
      {
        id: 'fade',
        type: 'transition',
        enabled: true,
        source: 'user',
        start: 0,
        end: 0.1 + 0.2,
        params: { kind: 'fade_out' },
      },
    ];
    expect(compileTimeline(p, 0.3).duration).toBe(0.3);
  });
  it('bounds long text and excludes storage/execution internals from response views', () => {
    const wrapped = previewText('word '.repeat(20), 40, 720, 1280);
    expect(wrapped.split('\n').every((line) => line.length <= 17)).toBe(true);
    expect(() => previewText('W'.repeat(1000), 160, 720, 1280)).toThrow(
      'does not fit',
    );
    expect(() => previewText('   ', 20, 720, 1280)).toThrow();
    expect(
      editView({
        _id: 'v',
        status: 'completed',
        sourceMedia: { storageKey: 'secret' },
        outputKey: 'secret',
        executionToken: 'secret',
        pendingOutputKeys: ['secret'],
        assetEtags: { a: 'secret' },
      }),
    ).toEqual({ _id: 'v', status: 'completed' });
  });
  it('aligns short segments to output frames without cumulative drift or invalid source mappings', () => {
    const p = examplePlan();
    p.video.segments = Array.from({ length: 24 }, (_, i) => ({
      id: `s${i}`,
      type: 'video',
      sourceStart: i * 0.04,
      sourceEnd: (i + 1) * 0.04,
      crossfade: 0,
    }));
    const timeline = compileTimeline(p, 3);
    expect(timeline.duration).toBe(0.8);
    expect(sourceToOutput(timeline, 0.039)).toEqual([]);
  });
  it('rejects unsupported types, raw filters, URLs, nonfinite numbers and unknown parameters', () => {
    for (const op of [
      { id: 'x', type: 'shell', start: 0, end: 1, params: {} },
      {
        id: 'x',
        type: 'zoom',
        start: 0,
        end: 1,
        params: { fromScale: 1, toScale: Infinity, focusX: 0.5, focusY: 0.5 },
      },
      {
        id: 'x',
        type: 'image_overlay',
        start: 0,
        end: 1,
        params: { assetId: 'https://evil.test', x: 0, y: 0, width: 0.2 },
      },
      {
        id: 'x',
        type: 'crop',
        start: 0,
        end: 1,
        params: { x: 0, y: 0, width: 1, height: 1, ffmpeg: 'evil' },
      },
    ])
      expect(() =>
        parseEdit(planSchema, { ...examplePlan(), operations: [op] }),
      ).toThrow(BadRequestException);
  });
  it('maps source trims, inserted freeze silence and crossfade offsets', () => {
    const p = examplePlan();
    p.video.segments = [
      { id: 'a', type: 'video', sourceStart: 2, sourceEnd: 4, crossfade: 0 },
      {
        id: 'freeze',
        type: 'freeze_frame',
        sourceTime: 4,
        duration: 1,
        audio: 'silence',
        crossfade: 0,
      },
      { id: 'b', type: 'video', sourceStart: 4, sourceEnd: 6, crossfade: 0 },
      { id: 'c', type: 'video', sourceStart: 6, sourceEnd: 8, crossfade: 0.5 },
    ];
    const t = compileTimeline(p, 8);
    expect(t.duration).toBe(6.5);
    expect(sourceToOutput(t, 4.5)).toEqual([3.5]);
    expect(t.segments[3].outputStart).toBe(4.5);
    const spec = buildRenderSpec(
      p,
      {
        path: '/source.mp4',
        hasAudio: true,
        duration: 8,
        width: 320,
        height: 180,
      },
      new Map(),
      '/tmp',
    );
    expect(spec.filters).toContain('tpad=stop_mode=clone:stop_duration=1');
    expect(spec.filters).toContain(
      'xfade=transition=fade:duration=0.5:offset=4.5',
    );
    expect(spec.filters).toContain('acrossfade=d=0.5');
    expect(spec.filters).toContain(
      'anullsrc=r=48000:cl=stereo,atrim=duration=1',
    );
  });
  it('rejects impossible segments, overlapping reframes and invalid track automation', () => {
    const p = examplePlan();
    p.video.segments[0] = {
      id: 'a',
      type: 'video',
      sourceStart: 0,
      sourceEnd: 4,
      crossfade: 0,
    };
    expect(() => compileTimeline(p, 3)).toThrow();
    p.video.segments[0] = {
      id: 'a',
      type: 'video',
      sourceStart: 0,
      sourceEnd: 3,
      crossfade: 0,
    };
    p.operations = parseEdit(planSchema, {
      ...p,
      operations: [0, 1].map((i) => ({
        id: String(i),
        type: 'zoom',
        start: i,
        end: i + 2,
        params: { fromScale: 1, toScale: 1.3, focusX: 0.5, focusY: 0.5 },
      })),
    }).operations;
    expect(() => compileTimeline(p, 3)).toThrow();
    p.operations = [];
    p.audio.original.automation = [
      { time: 2, gain: 0.5 },
      { time: 1, gain: 1 },
    ];
    expect(() => compileTimeline(p, 3)).toThrow();
  });
  it('keeps text out of filters and arguments and implements every operation in the catalog', () => {
    const p = parseEdit(planSchema, {
      ...examplePlan(),
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
          start: 1,
          end: 2,
          params: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        },
        {
          id: 't',
          type: 'text_overlay',
          start: 0,
          end: 3,
          params: {
            text: "':;[evil] %{metadata}\nTest",
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
          end: 0.2,
          params: { kind: 'fade_in' },
        },
        {
          id: 'out',
          type: 'transition',
          start: 2.8,
          end: 3,
          params: { kind: 'fade_out' },
        },
      ],
    });
    const spec = buildRenderSpec(
      p,
      {
        path: '/source.mp4',
        hasAudio: false,
        duration: 3,
        width: 320,
        height: 180,
      },
      new Map([['png', { path: '/asset.png', hasAudio: false, duration: 0 }]]),
      '/tmp',
    );
    expect(spec.args.join(' ')).not.toContain('[evil]');
    expect(spec.filters).not.toContain('[evil]');
    expect(spec.textFiles[0].text).toContain('[evil]');
    for (const filter of [
      'zoompan',
      'cos(PI',
      'crop=',
      'overlay=',
      'colorchannelmixer',
      'drawtext=',
      'expansion=none',
      'fade=t=in',
      'fade=t=out',
      'alimiter=',
    ])
      expect(spec.filters).toContain(filter);
    expect(
      buildRenderSpec(
        p,
        {
          path: '/source.mp4',
          hasAudio: false,
          duration: 3,
          width: 320,
          height: 180,
        },
        new Map([
          ['png', { path: '/asset.png', hasAudio: false, duration: 0 }],
        ]),
        '/tmp',
      ),
    ).toEqual(spec);
  });
  it('compiles gain automation, mutes and fades with output-relative track offsets', () => {
    const p = examplePlan();
    p.audio.original.automation = [
      { time: 0, gain: 1 },
      { time: 1, gain: 0 },
      { time: 2, gain: 1 },
    ];
    p.audio.original.mutes = [{ start: 1, end: 2 }];
    expect(gainExpression(p.audio.original, 0)).toContain(
      'gte((t+0),1)*lt((t+0),2)',
    );
    p.audio.tracks = [
      {
        id: 'music',
        role: 'music_track',
        assetId: 'audio',
        start: 1,
        sourceStart: 0.5,
        sourceEnd: 2.5,
        enabled: true,
        gain: 0.2,
        fadeIn: 0.2,
        fadeOut: 0.2,
        mutes: [],
        automation: [
          { time: 1, gain: 0.2 },
          { time: 2, gain: 0.8 },
        ],
      },
    ];
    const spec = buildRenderSpec(
      p,
      { path: '/source', hasAudio: true, duration: 3, width: 320, height: 180 },
      new Map([['audio', { path: '/audio', duration: 3, hasAudio: true }]]),
      '/tmp',
    );
    expect(spec.filters).toContain('atrim=start=0.5:duration=2');
    expect(spec.filters).toContain('adelay=1000:all=1');
    expect(spec.filters).toContain('afade=t=out:st=1.8:d=0.2');
    expect(spec.filters).toContain('amix=inputs=3');
  });
  it('rejects pathological operation counts and complexity budgets with structured issues', () => {
    const p = examplePlan();
    expect(() =>
      parseEdit(planSchema, { ...p, operations: Array(61).fill({}) }),
    ).toThrow();
    p.video.resolution = '1080p';
    p.video.segments = [
      { id: 'a', type: 'video', sourceStart: 0, sourceEnd: 600, crossfade: 0 },
    ];
    p.operations = Array.from({ length: 60 }, (_, i) => ({
      id: `${i}`,
      type: 'transition',
      start: 0,
      end: 1,
      enabled: true,
      source: 'user',
      params: { kind: 'fade_in' },
    }));
    try {
      compileTimeline(p, 600);
      throw new Error('Expected rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toHaveProperty('issues');
    }
  });
});

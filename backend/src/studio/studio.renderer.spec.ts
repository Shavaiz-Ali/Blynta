import { canvasSize, renderPlan } from './studio.renderer';
import { defaultTracks, makeClip } from './studio.contract';
describe('Studio render contract', () => {
  it('uses consistent canonical canvas dimensions for every supported ratio', () => {
    expect(canvasSize('16:9')).toEqual({ width: 1280, height: 720 });
    expect(canvasSize('9:16')).toEqual({ width: 720, height: 1280 });
    expect(canvasSize('1:1', 1080)).toEqual({ width: 1080, height: 1080 });
    expect(canvasSize('4:5', 1080)).toEqual({ width: 1080, height: 1350 });
  });
  it('keeps user text outside command arguments and skips hidden or muted tracks', () => {
    const a = {
      id: 'a',
      name: 'safe',
      kind: 'text' as const,
      duration: 2,
      origin: 'Text' as const,
    };
    const clip = {
      ...makeClip(a),
      name: "quotes ':; [evil] %{metadata} and a newline\nSecond line",
    };
    const doc = {
      name: 'test',
      ratio: '16:9' as const,
      assets: [a],
      tracks: defaultTracks,
      clips: [clip],
    };
    const plan = renderPlan(doc, { resolution: '720p', fps: 30 }, new Map());
    expect(plan.textFiles[0].text).toBe(clip.name);
    expect(plan.args.join(' ')).not.toContain(clip.name);
    expect(plan.filters).toContain('expansion=none');
    const hidden = renderPlan(
      { ...doc, tracks: defaultTracks.map((t) => ({ ...t, hidden: true })) },
      { resolution: '720p', fps: 30 },
      new Map(),
    );
    expect(hidden.textFiles).toHaveLength(0);
  });
});

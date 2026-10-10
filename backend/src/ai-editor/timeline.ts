import { BadRequestException } from '@nestjs/common';
import type { EditPlan } from './edit-plan.contract';

export function compileTimeline(plan: EditPlan, sourceDuration: number) {
  const issues: { path: string; message: string }[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ path, message });
  if (
    !Number.isFinite(sourceDuration) ||
    sourceDuration <= 0 ||
    sourceDuration > 600
  )
    fail('source', 'Source duration is invalid');
  let duration = 0;
  const frameTime = (seconds: number) =>
    Math.round(seconds * plan.video.fps) / plan.video.fps;
  const segments = plan.video.segments.map((s, i) => {
    const length = frameTime(
      s.type === 'video' ? s.sourceEnd - s.sourceStart : s.duration,
    );
    const crossfade = frameTime(s.crossfade);
    if (s.crossfade > 0 && crossfade === 0)
      fail(
        `video.segments.${i}.crossfade`,
        'Crossfade must contain at least one output frame',
      );
    if (length < 1 / plan.video.fps)
      fail(
        `video.segments.${i}`,
        'Segment must contain at least one output frame',
      );
    if (
      s.type === 'video'
        ? s.sourceEnd > sourceDuration + 1e-6 || s.sourceStart >= s.sourceEnd
        : s.sourceTime > sourceDuration - 1 / plan.video.fps
    )
      fail(`video.segments.${i}`, 'Source range is outside the clip');
    const previous = plan.video.segments[i - 1];
    const previousLength = frameTime(
      previous?.type === 'video'
        ? previous.sourceEnd - previous.sourceStart
        : (previous?.duration ?? 0),
    );
    const previousOverlap = frameTime(previous?.crossfade ?? 0);
    if (
      s.crossfade &&
      (!previous ||
        s.type !== 'video' ||
        previous.type !== 'video' ||
        crossfade + previousOverlap >= previousLength ||
        crossfade >= length)
    )
      fail(
        `video.segments.${i}.crossfade`,
        'Crossfade requires adjacent video segments with non-overlapping transition windows',
      );
    const start = frameTime(duration - crossfade);
    duration = frameTime(start + length);
    return { ...s, crossfade, outputStart: start, outputEnd: duration, length };
  });
  if (duration <= 0 || duration > 600)
    fail(
      'video.segments',
      'Output duration must be between one frame and 600 seconds',
    );
  for (const items of [
    plan.video.segments,
    plan.operations,
    plan.audio.tracks,
    plan.captions,
  ])
    if (new Set(items.map((x: { id: string }) => x.id)).size !== items.length)
      fail('id', 'IDs must be unique within each collection');
  const checkInterval = (start: number, end: number, path: string) => {
    if (end <= start || end > duration + 1e-6 || start < 0)
      fail(
        path,
        'Interval must have positive length and lie within the output timeline',
      );
  };
  const checkCrop = (
    c: { x: number; y: number; width: number; height: number },
    path: string,
  ) => {
    if (c.x + c.width > 1 || c.y + c.height > 1)
      fail(path, 'Crop exceeds normalized source bounds');
  };
  if (plan.video.crop) checkCrop(plan.video.crop, 'video.crop');
  for (const [i, op] of plan.operations.entries()) {
    checkInterval(op.start, op.end, `operations.${i}`);
    if (op.type === 'crop') checkCrop(op.params, `operations.${i}.params`);
    if (
      (op.type === 'image_overlay' || op.type === 'emoji_overlay') &&
      op.params.fadeIn + op.params.fadeOut > op.end - op.start
    )
      fail(
        `operations.${i}.params`,
        'Overlay fades exceed visibility interval',
      );
    if (
      op.type === 'transition' &&
      (op.params.kind === 'fade_in'
        ? op.start !== 0
        : Math.abs(op.end - duration) > 0.001)
    )
      fail(
        `operations.${i}`,
        'Fade-in must start at zero; fade-out must end at output duration',
      );
  }
  const effects = plan.operations.filter(
    (o) => o.enabled && ['zoom', 'crop'].includes(o.type),
  );
  for (const [i, op] of effects.entries())
    for (const other of effects.slice(i + 1))
      if (op.start < other.end && other.start < op.end)
        fail(
          'operations',
          'Zoom/crop windows must not overlap; combine the intended reframing into one effect',
        );
  const controls = (
    c: EditPlan['audio']['original'],
    start: number,
    end: number,
    path: string,
  ) => {
    if (c.fadeIn + c.fadeOut > end - start)
      fail(path, 'Audio fades exceed track length');
    for (const m of c.mutes) {
      checkInterval(m.start, m.end, path + '.mutes');
      if (m.start < start || m.end > end)
        fail(path + '.mutes', 'Mute must lie within its track');
    }
    let last = -1;
    for (const k of c.automation) {
      if (k.time <= last || k.time < start || k.time > end)
        fail(
          path + '.automation',
          'Keyframes must be strictly increasing within the track',
        );
      last = k.time;
    }
  };
  controls(plan.audio.original, 0, duration, 'audio.original');
  for (const [i, t] of plan.audio.tracks.entries()) {
    const end = Math.min(duration, t.start + t.sourceEnd - t.sourceStart);
    if (t.sourceEnd <= t.sourceStart || t.start >= duration)
      fail(
        `audio.tracks.${i}`,
        'Track must have a positive trim range and start before output ends',
      );
    controls(t, t.start, end, `audio.tracks.${i}`);
  }
  for (const [i, c] of plan.captions.entries())
    for (const cue of c.cues)
      checkInterval(cue.start, cue.end, `captions.${i}.cues`);
  const overlays = plan.operations.filter(
    (o) =>
      o.enabled && (o.type === 'image_overlay' || o.type === 'emoji_overlay'),
  );
  if (overlays.length > 8)
    fail('operations', 'Preview supports at most eight image overlays');
  if (
    plan.captions
      .filter((c) => c.visible && c.burnIn)
      .reduce((n, c) => n + c.cues.length, 0) > 150
  )
    fail('captions', 'Preview supports at most 150 burned caption cues');
  const complexity =
    duration *
    (plan.video.resolution === '1080p' ? 2.25 : 1) *
    (1 +
      plan.operations.length / 10 +
      plan.audio.tracks.length / 4 +
      plan.captions.reduce((n, c) => n + c.cues.length, 0) / 50);
  if (complexity > 5000)
    fail(
      'plan',
      'Rendering complexity exceeds the Phase 1 budget; shorten the timeline or reduce effects',
    );
  if (issues.length)
    throw new BadRequestException({
      message: 'EditPlan timeline validation failed',
      code: 'INVALID_TIMELINE',
      issues,
    });
  return { duration, segments, complexity };
}
export type Timeline = ReturnType<typeof compileTimeline>;
/** A repeated source range can map to several output times; callers must choose explicitly. */
export function sourceToOutput(timeline: Timeline, time: number) {
  return timeline.segments.flatMap((s) =>
    s.type === 'video' &&
    time >= s.sourceStart &&
    time < Math.min(s.sourceEnd, s.sourceStart + s.length)
      ? [s.outputStart + time - s.sourceStart]
      : [],
  );
}

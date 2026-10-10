import { join } from 'node:path';
import type { EditPlan, EditOperation } from './edit-plan.contract';
import { compileTimeline } from './timeline';
import { audioFilters } from './audio-effects';
import { canvasSize } from '../studio/studio.renderer';

export interface LocalMedia {
  path: string;
  hasAudio: boolean;
  duration: number;
  width?: number;
  height?: number;
  format?: string;
}
export const filterPath = (path: string) =>
  `'${path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''")}'`;
const enable = (start: number, end: number) => `gte(t,${start})*lt(t,${end})`;
/** Conservative wrapping: at most one em per code point, with room for outlines. */
export function previewText(
  text: string,
  fontSize: number,
  width: number,
  height: number,
) {
  const columns = Math.max(1, Math.floor((width - 32) / fontSize));
  const lines = text.split(/\r?\n/).flatMap((line) => {
    const chars = Array.from(line);
    if (!chars.length) return [''];
    return Array.from({ length: Math.ceil(chars.length / columns) }, (_, i) =>
      chars.slice(i * columns, (i + 1) * columns).join(''),
    );
  });
  if (!text.trim() || lines.length * fontSize * 1.4 > height - 32)
    throw new Error(
      'Text does not fit the preview canvas; shorten it or reduce font size',
    );
  return lines.join('\n');
}
const crop = (c: { x: number; y: number; width: number; height: number }) =>
  `crop=w=trunc(iw*${c.width}/2)*2:h=trunc(ih*${c.height}/2)*2:x=iw*${c.x}:y=ih*${c.y}`;

/** Pure compiler: no URLs, command strings, asset resolution or persistence. */
export function buildRenderSpec(
  plan: EditPlan,
  source: LocalMedia,
  assets: Map<string, LocalMedia>,
  directory: string,
  options: {
    relativeTextPaths?: boolean;
    fontFiles?: Record<string, string>;
  } = {},
) {
  const timeline = compileTimeline(plan, source.duration);
  if (
    !source.width ||
    !source.height ||
    source.width < 16 ||
    source.height < 16
  )
    throw new Error('Source video dimensions are invalid');
  const size = canvasSize(
    plan.video.aspectRatio === 'preserve'
      ? `${source.width}:${source.height}`
      : plan.video.aspectRatio,
    plan.video.resolution === '1080p' ? 1080 : 720,
  );
  if (size.width > 1920 || size.height > 1920)
    throw new Error(
      'Preview dimensions exceed 1920 pixels; select a supported aspect ratio',
    );
  const { width: w, height: h } = size;
  if (
    plan.video.crop &&
    (Math.floor((source.width * plan.video.crop.width) / 2) < 1 ||
      Math.floor((source.height * plan.video.crop.height) / 2) < 1)
  )
    throw new Error('Source crop must contain at least two pixels per side');
  const fps = plan.video.fps;
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
  const args = [
    '-y',
    '-nostdin',
    '-protocol_whitelist',
    'file,pipe',
    '-f',
    'mov',
    '-enable_drefs',
    '0',
    '-use_absolute_path',
    '0',
    '-i',
    source.path,
  ];
  const filters: string[] = [];
  const textFiles: { path: string; text: string }[] = [];
  let video = 'sv0',
    audio = 'sa0';
  timeline.segments.forEach((s, i) => {
    const trim =
      s.type === 'video'
        ? `trim=start=${s.sourceStart}:end=${s.sourceEnd},setpts=PTS-STARTPTS`
        : `trim=start=${s.sourceTime},select='eq(n,0)',setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${s.duration},trim=duration=${s.duration}`;
    filters.push(
      `[0:v]fps=${fps},${trim},tpad=stop_mode=clone:stop_duration=${1 / fps},trim=duration=${s.length},setpts=PTS-STARTPTS,${plan.video.crop ? crop(plan.video.crop) + ',' : ''}${fit},format=yuv420p,settb=AVTB[sv${i}]`,
    );
    if (s.type === 'video' && source.hasAudio)
      filters.push(
        `[0:a]atrim=start=${s.sourceStart}:end=${s.sourceEnd},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${s.length}[sa${i}]`,
      );
    else
      filters.push(
        `anullsrc=r=48000:cl=stereo,atrim=duration=${s.length},asetpts=PTS-STARTPTS[sa${i}]`,
      );
    if (i) {
      if (s.crossfade) {
        filters.push(
          `[${video}][sv${i}]xfade=transition=fade:duration=${s.crossfade}:offset=${s.outputStart}[joinedv${i}]`,
        );
        filters.push(
          `[${audio}][sa${i}]acrossfade=d=${s.crossfade}:c1=tri:c2=tri[joineda${i}]`,
        );
      } else {
        filters.push(`[${video}][sv${i}]concat=n=2:v=1:a=0[joinedv${i}]`);
        filters.push(`[${audio}][sa${i}]concat=n=2:v=0:a=1[joineda${i}]`);
      }
      video = `joinedv${i}`;
      audio = `joineda${i}`;
    }
  });
  let index = 1;
  const assetInputs = new Map<string, number>();
  const addAsset = (id: string, image = false) => {
    if (assetInputs.has(id)) return assetInputs.get(id)!;
    const asset = assets.get(id);
    if (!asset) throw new Error('Asset not resolved');
    const n = index++;
    if (image) args.push('-loop', '1', '-framerate', String(fps));
    args.push('-threads', '1', '-protocol_whitelist', 'file,pipe');
    if (asset.format) args.push('-f', asset.format);
    if (asset.format === 'mov')
      args.push('-enable_drefs', '0', '-use_absolute_path', '0');
    args.push('-i', asset.path);
    assetInputs.set(id, n);
    return n;
  };
  const audios: string[] = [];
  if (plan.audio.original.enabled) {
    filters.push(
      `[${audio}]${audioFilters(plan.audio.original, 0, timeline.duration)}[original]`,
    );
    audios.push('[original]');
  } else filters.push(`[${audio}]anullsink`);
  plan.audio.tracks.forEach((track, i) => {
    if (!track.enabled) return;
    const input = addAsset(track.assetId);
    const duration = Math.min(
      track.sourceEnd - track.sourceStart,
      timeline.duration - track.start,
    );
    filters.push(
      `[${input}:a]atrim=start=${track.sourceStart}:duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${audioFilters(track, track.start, duration)},adelay=${Math.round(track.start * 1000)}:all=1[track${i}]`,
    );
    audios.push(`[track${i}]`);
  });
  filters.push(
    `anullsrc=r=48000:cl=stereo,atrim=duration=${timeline.duration}[silence]`,
  );
  filters.push(
    `[silence]${audios.join('')}amix=inputs=${audios.length + 1}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=0:latency=1,atrim=duration=${timeline.duration}[audio]`,
  );
  const operations: EditOperation[] = [...plan.operations];
  for (const c of plan.captions)
    if (c.visible && c.burnIn)
      for (const [i, cue] of c.cues.entries())
        operations.push({
          id: `${c.id}-${i}`,
          type: 'text_overlay',
          start: cue.start,
          end: cue.end,
          enabled: true,
          source: 'system',
          params: {
            ...c.style,
            text: cue.text,
            x: 0.5,
            y: 0.9,
            outline: 2,
            shadow: true,
          },
        });
  operations.forEach((op, i) => {
    if (!op.enabled) return;
    const out = `effect${i}`;
    if (op.type === 'zoom') {
      const p = op.params;
      const time = `on/${fps}`;
      const fraction = `min(1,max(0,(${time}-${op.start})/${op.end - op.start}))`;
      const ease =
        p.easing === 'easeInOut' ? `(1-cos(PI*${fraction}))/2` : fraction;
      const zoom = `if(gte(${time},${op.start})*lt(${time},${op.end}),${p.fromScale}+(${p.toScale}-${p.fromScale})*${ease},1)`;
      filters.push(
        `[${video}]zoompan=z='${zoom}':x='min(iw-iw/zoom,max(0,iw*${p.focusX}-iw/zoom/2))':y='min(ih-ih/zoom,max(0,ih*${p.focusY}-ih/zoom/2))':d=1:s=${w}x${h}:fps=${fps}[${out}]`,
      );
    } else if (op.type === 'crop') {
      filters.push(`[${video}]split=2[cropbase${i}][cropin${i}]`);
      filters.push(`[cropin${i}]${crop(op.params)},${fit}[cropregion${i}]`);
      filters.push(
        `[cropbase${i}][cropregion${i}]overlay=enable='${enable(op.start, op.end)}'[${out}]`,
      );
    } else if (op.type === 'transition') {
      filters.push(
        `[${video}]fade=t=${op.params.kind === 'fade_in' ? 'in' : 'out'}:st=${op.start}:d=${op.end - op.start}[${out}]`,
      );
    } else if (op.type === 'text_overlay') {
      const p = op.params;
      const path = join(directory, `text-${i}.txt`);
      textFiles.push({ path, text: previewText(p.text, p.fontSize, w, h) });
      const font = {
        sans: 'Liberation Sans',
        serif: 'Liberation Serif',
        mono: 'Liberation Mono',
      }[p.font];
      const fontOption = options.fontFiles
        ? `fontfile=${filterPath(options.fontFiles[p.font])}`
        : `font='${font}'`;
      filters.push(
        `[${video}]drawtext=${fontOption}:textfile=${filterPath(options.relativeTextPaths ? `text-${i}.txt` : path)}:expansion=none:fontsize=${p.fontSize}:fontcolor=${p.color}:borderw=${p.outline}:bordercolor=black:shadowx=${p.shadow ? 2 : 0}:shadowy=${p.shadow ? 2 : 0}:x=(w-text_w)*${p.x}:y=(h-text_h)*${p.y}:enable='${enable(op.start, op.end)}'[${out}]`,
      );
    } else {
      const p = op.params,
        input = addAsset(p.assetId, true);
      filters.push(
        `[${input}:v]scale=${Math.max(2, Math.round((w * p.width) / 2) * 2)}:${h}:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=${p.opacity}${p.fadeIn ? `,fade=t=in:st=${op.start}:d=${p.fadeIn}:alpha=1` : ''}${p.fadeOut ? `,fade=t=out:st=${op.end - p.fadeOut}:d=${p.fadeOut}:alpha=1` : ''}[overlay${i}]`,
      );
      filters.push(
        `[${video}][overlay${i}]overlay=x=(W-w)*${p.x}:y=(H-h)*${p.y}:enable='${enable(op.start, op.end)}':eof_action=pass[${out}]`,
      );
    }
    video = out;
  });
  filters.push(`[${video}]fps=${fps},format=yuv420p[video]`);
  args.push(
    '-filter_complex_script',
    join(directory, 'filters.txt'),
    '-map',
    '[video]',
    '-map',
    '[audio]',
    '-t',
    String(timeline.duration),
    '-r',
    String(fps),
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    '-progress',
    'pipe:1',
    join(directory, 'output.mp4'),
  );
  return {
    args,
    filters: filters.join(';\n'),
    textFiles,
    duration: timeline.duration,
    ...size,
  };
}

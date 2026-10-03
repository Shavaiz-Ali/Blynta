import type { StudioDocument } from './studio.contract';

export function canvasSize(ratio: string, shortSide = 720) {
  const [w, h] = ratio.split(':').map(Number);
  return w >= h
    ? { width: Math.round((shortSide * w) / h / 2) * 2, height: shortSide }
    : { width: shortSide, height: Math.round((shortSide * h) / w / 2) * 2 };
}
export interface RenderInput {
  path: string;
  hasAudio: boolean;
}
// Paths are generated inside an isolated work directory. Text uses textfile with
// expansion disabled, so content cannot become filter expressions or commands.
export function renderPlan(
  doc: StudioDocument,
  settings: { resolution: string; fps: number },
  inputs: Map<string, RenderInput>,
) {
  const size = canvasSize(
    doc.ratio,
    settings.resolution === '1080p' ? 1080 : 720,
  );
  const factor = size.height / 720;
  const duration = Math.max(...doc.clips.map((c) => c.start + c.duration));
  const args = [
    '-y',
    '-filter_complex_threads',
    '1',
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${size.width}x${size.height}:r=${settings.fps}:d=${duration}`,
    '-f',
    'lavfi',
    '-i',
    `anullsrc=r=48000:cl=stereo`,
  ];
  const filters: string[] = ['[0:v]format=rgba[base]'];
  const textFiles: { name: string; text: string }[] = [];
  const audios: string[] = [];
  let inputIndex = 2;
  let video = 'base';
  const clips = [...doc.clips].sort(
    (a, b) =>
      doc.tracks.findIndex((t) => t.id === b.trackId) -
      doc.tracks.findIndex((t) => t.id === a.trackId),
  );
  clips.forEach((c, index) => {
    const track = doc.tracks.find((t) => t.id === c.trackId)!;
    if (track.hidden) return;
    const enable = `gte(t,${c.start})*lt(t,${c.start + c.duration})`;
    const fadeIn = Math.min(c.duration, c.fadeIn);
    const fadeOut = Math.min(c.duration, c.fadeOut);
    const fade = (start: number) =>
      `${fadeIn ? `,fade=t=in:st=${start}:d=${fadeIn}:alpha=1` : ''}${fadeOut ? `,fade=t=out:st=${start + c.duration - fadeOut}:d=${fadeOut}:alpha=1` : ''}`;
    if (c.kind === 'text') {
      // Text rasterized on a transparent canvas before applying the same transform as media.
      const name = `text-${index}.txt`;
      textFiles.push({ name, text: c.name });
      const font =
        c.fontFamily === 'Georgia'
          ? 'Liberation Serif'
          : c.fontFamily === 'Courier New'
            ? 'Liberation Mono'
            : 'Liberation Sans';
      const weight = (c.fontWeight ?? 700) === 700 ? 'Bold' : 'Regular';
      const x =
        c.textAlign === 'left'
          ? `${size.width * 0.1}`
          : c.textAlign === 'right'
            ? `${size.width * 0.9}-text_w`
            : '(w-text_w)/2';
      filters.push(
        `color=c=black@0:s=${size.width}x${size.height}:r=${settings.fps}:d=${duration},format=rgba,drawtext=font='${font}\\:style=${weight}':textfile=${name}:expansion=none:fontsize=${c.fontSize * factor}:fontcolor=${c.color}:x=${x}:y=h*0.82-text_h:line_spacing=${c.fontSize * factor * 0.25}[text${index}]`,
      );
      filters.push(
        `[text${index}]scale=iw*${c.scale / 100}:ih*${c.scale / 100},rotate=${c.rotation}*PI/180:ow=rotw(${c.rotation}*PI/180):oh=roth(${c.rotation}*PI/180):c=none,colorchannelmixer=aa=${c.opacity / 100}${fade(c.start)}[layer${index}]`,
      );
      filters.push(
        `[${video}][layer${index}]overlay=x=(W-w)/2+${c.x * factor}:y=(H-h)/2+${c.y * factor}:enable='${enable}':eof_action=pass[out${index}]`,
      );
      video = `out${index}`;
      return;
    }
    const input = inputs.get(c.assetId);
    if (!input) throw new Error('Render asset missing');
    const n = inputIndex++;
    if (c.kind === 'image') args.push('-loop', '1');
    args.push('-i', input.path);
    if (c.kind !== 'audio') {
      const fit =
        c.fit === 'cover'
          ? `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`
          : `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
      filters.push(
        `[${n}:v]trim=start=${c.offset}:duration=${c.duration * c.speed},setpts=(PTS-STARTPTS)/${c.speed},fps=${settings.fps},format=rgba,${fit},scale=iw*${c.scale / 100}:ih*${c.scale / 100},rotate=${c.rotation}*PI/180:ow=rotw(${c.rotation}*PI/180):oh=roth(${c.rotation}*PI/180):c=none,colorchannelmixer=aa=${c.opacity / 100}${fade(0)},setpts=PTS+${c.start}/TB[layer${index}]`,
      );
      filters.push(
        `[${video}][layer${index}]overlay=x=(W-w)/2+${c.x * factor}:y=(H-h)/2+${c.y * factor}:enable='${enable}':eof_action=pass:repeatlast=0[out${index}]`,
      );
      video = `out${index}`;
    }
    if (input.hasAudio && !track.muted && c.volume) {
      const tempo =
        c.speed < 0.5
          ? `atempo=0.5,atempo=${c.speed / 0.5}`
          : `atempo=${c.speed}`;
      filters.push(
        `[${n}:a]atrim=start=${c.offset}:duration=${c.duration * c.speed},asetpts=PTS-STARTPTS,${tempo},volume=${c.volume / 100}${fadeIn ? `,afade=t=in:d=${fadeIn}` : ''}${fadeOut ? `,afade=t=out:st=${c.duration - fadeOut}:d=${fadeOut}` : ''},aformat=channel_layouts=stereo,adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)}[a${index}]`,
      );
      audios.push(`[a${index}]`);
    }
  });
  filters.push(`[1:a]atrim=duration=${duration}[silence]`);
  filters.push(
    `[silence]${audios.join('')}amix=inputs=${audios.length + 1}:normalize=0:duration=first[audio]`,
  );
  filters.push(`[${video}]format=yuv420p[video]`);
  args.push(
    '-filter_complex_script',
    'filters.txt',
    '-map',
    '[video]',
    '-map',
    '[audio]',
    '-t',
    String(duration),
    '-r',
    String(settings.fps),
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '-progress',
    'pipe:1',
    'output.mp4',
  );
  return { args, filters: filters.join(';\n'), textFiles, duration };
}

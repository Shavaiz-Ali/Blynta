export interface FfmpegProgress {
  progress: number;
  processedSeconds: number;
  durationSeconds: number;
  speed?: number;
  etaSeconds?: number;
  frame?: number;
  fps?: number;
}

/** FFmpeg emits key/value blocks terminated by progress=continue/end. */
export function ffmpegProgressParser(
  durationSeconds: number,
  publish?: (progress: FfmpegProgress) => void,
) {
  const values: Record<string, string> = {};
  return (line: string) => {
    const match = /^([a-z_]+)=(.*)$/.exec(line.trim());
    if (!match) return;
    values[match[1]] = match[2];
    if (match[1] !== 'progress' || durationSeconds <= 0) return;
    const time = Number(values.out_time_us);
    if (!Number.isFinite(time) || time < 0) return;
    const processedSeconds = Math.min(durationSeconds, time / 1_000_000);
    const speed = Number(values.speed?.replace(/x$/, ''));
    const usableSpeed =
      Number.isFinite(speed) && speed > 0 && processedSeconds >= 1
        ? speed
        : undefined;
    publish?.({
      processedSeconds,
      durationSeconds,
      progress: Math.min(
        100,
        Math.max(0, (processedSeconds / durationSeconds) * 100),
      ),
      speed: usableSpeed,
      etaSeconds: usableSpeed
        ? (durationSeconds - processedSeconds) / usableSpeed
        : undefined,
      frame: Number.isFinite(Number(values.frame))
        ? Number(values.frame)
        : undefined,
      fps: Number.isFinite(Number(values.fps)) ? Number(values.fps) : undefined,
    });
  };
}

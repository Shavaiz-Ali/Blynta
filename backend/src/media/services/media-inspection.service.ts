import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

export interface MediaMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  bitrate?: number;
  fileSizeBytes?: number;
  audioCodec?: string;
  sampleRate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  disposition?: { attached_pic?: number };
}

export function normalizeMediaMetadata(raw: {
  streams?: ProbeStream[];
  format?: { duration?: string; bit_rate?: string; size?: string };
}): MediaMetadata {
  const video = raw.streams?.find(
    (s) => s.codec_type === 'video' && !s.disposition?.attached_pic,
  );
  const audio = raw.streams?.find((s) => s.codec_type === 'audio');
  const positive = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const rate = (value?: string) => {
    if (!value) return undefined;
    const [n, d = '1'] = value.split('/');
    return positive(Number(n) / Number(d));
  };
  return {
    durationSeconds: positive(raw.format?.duration) ?? 0,
    width: positive(video?.width),
    height: positive(video?.height),
    fps: rate(video?.avg_frame_rate) ?? rate(video?.r_frame_rate),
    codec: video?.codec_name,
    bitrate: positive(raw.format?.bit_rate),
    fileSizeBytes: positive(raw.format?.size),
    audioCodec: audio?.codec_name,
    sampleRate: positive(audio?.sample_rate),
    hasVideo: !!video,
    hasAudio: !!audio,
  };
}

@Injectable()
export class MediaInspectionService {
  constructor(private registry: ProcessRegistryService) {}
  async inspect(
    inputPath: string,
    localOnly = false,
    format?: string,
  ): Promise<MediaMetadata> {
    return new Promise((resolve, reject) => {
      const proc = execFile(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          ...(localOnly ? ['-protocol_whitelist', 'file,pipe'] : []),
          ...(format ? ['-f', format] : []),
          ...(localOnly && format === 'mov'
            ? ['-enable_drefs', '0', '-use_absolute_path', '0']
            : []),
          inputPath,
        ],
        { timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
        (error, stdout) => {
          if (error) return reject(new Error(error.message));
          try {
            resolve(
              normalizeMediaMetadata(
                JSON.parse(stdout) as Parameters<
                  typeof normalizeMediaMetadata
                >[0],
              ),
            );
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
      this.registry.register(proc);
    });
  }
}

export interface WorkloadEstimate {
  score: number;
  classification: 'small' | 'medium' | 'large';
}

/** Relative 10-minute 1080p30 workload; observability only, never worker allocation. */
export function estimateVideoWorkload(
  metadata: MediaMetadata,
  operations = { captions: true, crop: true },
): WorkloadEstimate {
  const pixels = (metadata.width ?? 1920) * (metadata.height ?? 1080);
  const codecFactor = /hevc|av1|vp9/i.test(metadata.codec ?? '') ? 1.3 : 1;
  const score =
    Math.round(
      100 *
        (metadata.durationSeconds / 600) *
        Math.max(0.25, pixels / (1920 * 1080)) *
        ((metadata.fps ?? 30) / 30) *
        codecFactor *
        (1 + (operations.captions ? 0.5 : 0) + (operations.crop ? 0.2 : 0)),
    ) / 100;
  return {
    score,
    classification: score < 1 ? 'small' : score < 5 ? 'medium' : 'large',
  };
}

import { Injectable, Logger } from '@nestjs/common';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ffmpegProgressParser, FfmpegProgress } from '../utils/ffmpeg-progress';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

@Injectable()
export class ClipCuttingService {
  private readonly logger = new Logger(ClipCuttingService.name);

  constructor(private processRegistry: ProcessRegistryService) {}

  /**
   * Cut and vertically crop a clip from a source video.
   *
   * @param cropX Optional pixel X offset (number) or dynamic FFmpeg crop expression
   *   (string) for the 9:16 crop window. When omitted the existing center-crop
   *   behaviour is preserved.
   */
  async cutClip(
    sourceVideoPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
    onProgress?: (progress: FfmpegProgress) => void,
    cropX?: number | string,
  ): Promise<string> {
    const duration = endTime - startTime;
    if (duration <= 0) {
      throw new Error(
        `Invalid clip range: startTime=${startTime}, endTime=${endTime}`,
      );
    }

    this.logger.log(
      `Cutting clip: ${/^https?:/.test(sourceVideoPath) ? 'private R2 source' : sourceVideoPath} [${startTime}s - ${endTime}s] -> ${outputPath}${cropX !== undefined ? ` cropX=${cropX}` : ''}`,
    );
    await this.cutAndCropWithFfmpeg(
      sourceVideoPath,
      startTime,
      duration,
      outputPath,
      onProgress,
      cropX,
    );
    return outputPath;
  }

  private async cutAndCropWithFfmpeg(
    sourceVideoPath: string,
    startTime: number,
    duration: number,
    outputPath: string,
    onProgress?: (progress: FfmpegProgress) => void,
    cropX?: number | string,
  ): Promise<void> {
    // When cropX is provided, use it as the explicit left-edge offset for the
    // 9:16 crop window. Otherwise fall back to the original center-crop
    // expression `crop=ih*9/16:ih` (implicit x=(iw-ow)/2 centering by FFmpeg).
    const cropFilter =
      cropX !== undefined
        ? `crop=ih*9/16:ih:${cropX}:0,scale=1080:1920:flags=lanczos`
        : 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos';

    await runCommandWithProgress(
      'ffmpeg',
      [
        '-ss',
        String(startTime),
        '-i',
        sourceVideoPath,
        '-t',
        String(duration),
        '-vf',
        cropFilter,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-progress',
        'pipe:1',
        '-nostats',
        '-y',
        outputPath,
      ],
      ffmpegProgressParser(duration, onProgress),
      this.processRegistry,
    );
  }
}

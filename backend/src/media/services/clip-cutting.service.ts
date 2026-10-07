import { Injectable, Logger } from '@nestjs/common';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ffmpegProgressParser, FfmpegProgress } from '../utils/ffmpeg-progress';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

@Injectable()
export class ClipCuttingService {
  private readonly logger = new Logger(ClipCuttingService.name);

  constructor(private processRegistry: ProcessRegistryService) {}

  async cutClip(
    sourceVideoPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
    onProgress?: (progress: FfmpegProgress) => void,
  ): Promise<string> {
    const duration = endTime - startTime;
    if (duration <= 0) {
      throw new Error(
        `Invalid clip range: startTime=${startTime}, endTime=${endTime}`,
      );
    }

    this.logger.log(
      `Cutting clip: ${sourceVideoPath} [${startTime}s - ${endTime}s] -> ${outputPath}`,
    );
    await this.cutAndCropWithFfmpeg(
      sourceVideoPath,
      startTime,
      duration,
      outputPath,
      onProgress,
    );
    return outputPath;
  }

  private async cutAndCropWithFfmpeg(
    sourceVideoPath: string,
    startTime: number,
    duration: number,
    outputPath: string,
    onProgress?: (progress: FfmpegProgress) => void,
  ): Promise<void> {
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
        'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos',
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

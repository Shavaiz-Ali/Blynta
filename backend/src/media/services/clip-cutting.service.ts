import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
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
  ): Promise<string> {
    const duration = endTime - startTime;
    if (duration <= 0) {
      throw new Error(`Invalid clip range: startTime=${startTime}, endTime=${endTime}`);
    }

    this.logger.log(`Cutting clip: ${sourceVideoPath} [${startTime}s - ${endTime}s] -> ${outputPath}`);
    await this.cutAndCropWithFfmpeg(sourceVideoPath, startTime, duration, outputPath);
    return outputPath;
  }

  private cutAndCropWithFfmpeg(
    sourceVideoPath: string,
    startTime: number,
    duration: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const vf = 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos';

      const cmd = ffmpeg(sourceVideoPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .outputOptions([`-vf ${vf}`])
        .outputOptions(['-c:v libx264', '-preset fast', '-crf 23'])
        .outputOptions(['-c:a aac', '-b:a 128k'])
        .outputOptions(['-movflags +faststart'])
        .outputOptions(['-y'])
        .on('end', () => resolve())
        .on('error', (err: Error, stdout: string, stderr: string) => {
          this.logger.error(`ffmpeg clip cut failed: ${err.message}\n${stderr}`);
          reject(new Error(`ffmpeg clip cut failed: ${err.message}`));
        });

      this.processRegistry.registerFfmpeg(cmd);
      cmd.save(outputPath);
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { TranscriptSegmentDto } from './transcription.service';

@Injectable()
export class CaptionBurningService {
  private readonly logger = new Logger(CaptionBurningService.name);

  async burnCaptions(
    inputVideoPath: string,
    segments: TranscriptSegmentDto[],
    outputVideoPath: string,
  ): Promise<string> {
    const srtPath = inputVideoPath.replace(/\.mp4$/, '.srt');
    const srtContent = this.buildSrt(segments);
    await fs.promises.writeFile(srtPath, srtContent, 'utf-8');

    this.logger.log(`Burning captions into ${outputVideoPath}`);
    await this.burnWithFfmpeg(inputVideoPath, srtPath, outputVideoPath);
    return outputVideoPath;
  }

  private buildSrt(segments: TranscriptSegmentDto[]): string {
    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.startTime);
        const end = this.formatSrtTime(seg.endTime);
        return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
      })
      .join('\n');
  }

  private formatSrtTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  }

  private burnWithFfmpeg(videoPath: string, srtPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedSrtPath = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      const filter = `subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Bold=1'`;

      ffmpeg(videoPath)
        .outputOptions([`-vf ${filter}`])
        .outputOptions(['-c:a copy'])
        .outputOptions(['-y'])
        .on('end', () => resolve())
        .on('error', (err: Error, stdout: string, stderr: string) => {
          this.logger.error(`ffmpeg caption burn failed: ${err.message}\n${stderr}`);
          reject(new Error(`ffmpeg caption burn failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }
}

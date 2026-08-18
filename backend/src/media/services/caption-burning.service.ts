import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { TranscriptSegmentDto } from './transcription.service';
import { CaptionStyleConfig } from '../style-presets';

@Injectable()
export class CaptionBurningService {
  private readonly logger = new Logger(CaptionBurningService.name);

  async burnCaptions(
    inputVideoPath: string,
    segments: TranscriptSegmentDto[],
    outputVideoPath: string,
    captionStyle?: CaptionStyleConfig,
  ): Promise<string> {
    const defaultStyle: CaptionStyleConfig = {
      fontFamily: 'Montserrat',
      fontSize: 64,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'none',
    };
    const style = captionStyle || defaultStyle;

    const assPath = inputVideoPath.replace(/\.mp4$/, '.ass');
    const assContent = this.buildAss(segments, style);
    await fs.promises.writeFile(assPath, assContent, 'utf-8');

    this.logger.log(`Burning captions into ${outputVideoPath}`);
    await this.burnWithFfmpeg(inputVideoPath, assPath, outputVideoPath);
    return outputVideoPath;
  }

  private buildAssHeader(style: CaptionStyleConfig): string {
    const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
    const marginV = style.position === 'bottom' ? 120 : style.position === 'top' ? 80 : 0;
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Default,${style.fontFamily},${style.fontSize},${style.primaryColor},${style.outlineColor},1,1,4,0,${alignment},${marginV}

[Events]
Format: Layer, Start, End, Style, Text
`;
  }

  private buildAss(segments: TranscriptSegmentDto[], style: CaptionStyleConfig): string {
    const header = this.buildAssHeader(style);
    const events = segments
      .map((seg) => {
        const start = this.formatAssTime(seg.startTime);
        const end = this.formatAssTime(seg.endTime);
        // TODO: word-pop/karaoke per-word timing
        const text = seg.text.replace(/\r?\n/g, ' ').trim();
        return `Dialogue: 0,${start},${end},Default,${text}`;
      })
      .join('\n');
    return `${header}${events}\n`;
  }

  private formatAssTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const cs = Math.floor((totalSeconds % 1) * 100);
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
  }

  private burnWithFfmpeg(videoPath: string, assPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedAssPath = assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
      const filter = `subtitles='${escapedAssPath}'`;

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

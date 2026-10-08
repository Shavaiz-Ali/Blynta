import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ffmpegProgressParser, FfmpegProgress } from '../utils/ffmpeg-progress';
import { TranscriptSegmentDto } from './transcription.service';
import { CaptionStyleConfig } from '../style-presets';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

@Injectable()
export class CaptionBurningService {
  private readonly logger = new Logger(CaptionBurningService.name);

  constructor(private processRegistry: ProcessRegistryService) {}

  async burnCaptions(
    inputVideoPath: string,
    segments: TranscriptSegmentDto[],
    outputVideoPath: string,
    captionStyle?: CaptionStyleConfig,
    durationSeconds = 0,
    onProgress?: (progress: FfmpegProgress) => void,
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

    this.assertGlyphCoverage(segments, style.fontFamily);
    const assPath = path.join(
      path.dirname(outputVideoPath),
      `${path.basename(outputVideoPath, path.extname(outputVideoPath))}.ass`,
    );
    const assContent = this.buildAss(segments, style);
    await fs.promises.writeFile(assPath, assContent, 'utf-8');

    this.logger.log(`Burning captions into ${outputVideoPath}`);
    await this.burnWithFfmpeg(
      inputVideoPath,
      assPath,
      outputVideoPath,
      durationSeconds,
      onProgress,
    );
    return outputVideoPath;
  }

  private fontCoverage = new Map<string, [number, number][]>();
  private assertGlyphCoverage(
    segments: TranscriptSegmentDto[],
    family: string,
  ) {
    if (process.platform !== 'linux') return; // Linux production uses Fontconfig; libass errors are checked on every platform.
    const fontsDir = process.env.CAPTION_FONTS_DIR;
    const key = `${family}:${fontsDir || ''}`;
    let ranges = this.fontCoverage.get(key);
    if (!ranges) {
      let charset: string;
      try {
        charset = execFileSync(
          'fc-match',
          ['-s', '--format=%{charset}\n', family],
          { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
        );
        if (fontsDir) {
          const files = fs
            .readdirSync(fontsDir)
            .filter((name) => /\.(ttf|otf)$/i.test(name))
            .map((name) => path.join(fontsDir, name));
          if (files.length)
            charset += execFileSync(
              'fc-scan',
              ['--format=%{charset}\n', ...files],
              { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
            );
        }
      } catch {
        throw new Error(
          'Caption font preflight failed. Install Fontconfig and supported fonts on the Linux worker.',
        );
      }
      ranges = charset
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => {
          const [a, b] = part.split('-');
          return [parseInt(a, 16), parseInt(b || a, 16)] as [number, number];
        });
      this.fontCoverage.set(key, ranges);
    }
    const missing = new Set<number>();
    for (const char of segments.map((s) => s.text).join('')) {
      const point = char.codePointAt(0)!;
      if (
        /\s|\p{Cf}|\p{Cc}/u.test(char) ||
        (point >= 0xfe00 && point <= 0xfe0f)
      )
        continue;
      if (!ranges.some(([a, b]) => point >= a && point <= b))
        missing.add(point);
    }
    if (missing.size) {
      this.logger.error({
        event: 'captions.glyphs.missing',
        font: family,
        codepoints: [...missing]
          .slice(0, 20)
          .map((n) => `U+${n.toString(16).toUpperCase()}`),
      });
      throw new Error(
        'Caption glyph coverage is incomplete. Install Noto fonts for the source language and retry.',
      );
    }
  }

  private buildAssHeader(style: CaptionStyleConfig): string {
    const alignment =
      style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
    const marginV =
      style.position === 'bottom' ? 120 : style.position === 'top' ? 80 : 0;
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily.replace(/[,\r\n]/g, '')},${style.fontSize},${style.primaryColor},${style.primaryColor},${style.outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,4,0,${alignment},80,80,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  }

  private buildAss(
    segments: TranscriptSegmentDto[],
    style: CaptionStyleConfig,
  ): string {
    const header = this.buildAssHeader(style);
    const events = segments
      .map((seg) => {
        const start = this.formatAssTime(seg.startTime);
        const end = this.formatAssTime(seg.endTime);
        // TODO: word-pop/karaoke per-word timing
        const text = seg.text
          .replace(/\r?\n/g, ' ')
          .replace(/\\/g, '\\\u2060')
          .replace(/\{/g, '\\{')
          .replace(/\}/g, '\\}')
          .trim();
        // Keep Latin styling while using script fonts with comparable visible glyph height.
        const renderedText = text.replace(
          /([\u0900-\u097f]+(?:[ \t]+[\u0900-\u097f]+)*)|([\u0600-\u06ff]+(?:[ \t]+[\u0600-\u06ff]+)*)/gu,
          (run, hindi) =>
            `{\\fn${hindi ? 'Noto Sans Devanagari' : 'Noto Sans Arabic'}\\fs${style.fontSize * 2}}${run}{\\r}`,
        );
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${renderedText}`;
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

  private async burnWithFfmpeg(
    videoPath: string,
    assPath: string,
    outputPath: string,
    durationSeconds: number,
    onProgress?: (progress: FfmpegProgress) => void,
  ): Promise<void> {
    const escapedAssPath = assPath
      .replace(/\\/g, '/')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'");
    let missingGlyph = false;
    const fontsDir = process.env.CAPTION_FONTS_DIR;
    const escapedFontsDir = fontsDir
      ?.replace(/\\/g, '/')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'");
    await runCommandWithProgress(
      'ffmpeg',
      [
        '-i',
        videoPath,
        '-vf',
        `subtitles='${escapedAssPath}':charenc=UTF-8${escapedFontsDir ? `:fontsdir='${escapedFontsDir}'` : ''}`,
        '-c:a',
        'copy',
        '-progress',
        'pipe:1',
        '-nostats',
        '-y',
        outputPath,
      ],
      (line) => {
        ffmpegProgressParser(durationSeconds, onProgress)(line);
        if (/failed to find any fallback|fontselect.*failed/i.test(line))
          missingGlyph = true;
        if (
          !/failed/i.test(line) &&
          /fontselect:|Shaper:|font provider:/i.test(line)
        )
          this.logger.debug(line.slice(0, 250));
      },
      this.processRegistry,
    );
    if (missingGlyph) {
      await fs.promises.unlink(outputPath).catch(() => {});
      throw new Error(
        'Caption font is missing glyphs. Install supported worker fonts and retry.',
      );
    }
  }
}

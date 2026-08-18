import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runCommandWithProgress } from '../utils/run-command-with-progress';

/**
 * YOUTUBE_COOKIES_PATH (optional):
 * Some YouTube videos require an authenticated session to download
 * ("Sign in to confirm you're not a bot"). To fix this, export a
 * cookies.txt file from a real, logged-in browser session and point
 * YOUTUBE_COOKIES_PATH at it.
 *
 * Recommended way to generate the file (no third-party browser extension
 * needed — use yt-dlp's own built-in exporter, ideally from Firefox):
 *
 *   yt-dlp --cookies-from-browser firefox --cookies /path/to/youtube-cookies.txt
 *
 * These cookies typically expire after 1-2 weeks and need to be
 * regenerated manually — this is a deliberate manual step, not
 * automated, given the security sensitivity of session cookies.
 * If YOUTUBE_COOKIES_PATH is unset or the file doesn't exist, downloads
 * proceed without cookies as before (most videos don't need them).
 */

@Injectable()
export class VideoDownloadService {
  private readonly logger = new Logger(VideoDownloadService.name);
  constructor(private configService: ConfigService) { }

  async downloadVideo(
    sourceUrl: string,
    outputDir: string,
    resolution: '720p' | '1080p' | '360p' | '240p',
    onProgress?: (percent: number) => void,
  ): Promise<{ videoPath: string; audioPath: string; title: string; uploader: string }> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    const videoPath = path.join(outputDir, 'source.mp4');
    const audioPath = path.join(outputDir, 'audio.wav');
    // const maxHeight = resolution === '1080p' ? 1080 : 720; //TODO: UNCOMMENT LATER
    const maxHeight = 240;

    const ytDlpArgs = [
      '--js-runtimes', 'deno',
      '-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`,
      '--merge-output-format', 'mp4',
      '--progress-template', 'download:PROGRESS %(progress._percent_str)s',
    ];

    const cookiesPath = this.configService.get<string>('YOUTUBE_COOKIES_PATH');
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      this.logger.log(`Using YouTube cookies from ${cookiesPath}`);
      ytDlpArgs.push('--cookies', cookiesPath);
    } else if (cookiesPath) {
      this.logger.warn(
        `YOUTUBE_COOKIES_PATH is set to "${cookiesPath}" but the file was not found — proceeding without cookies.`,
      );
    }

    ytDlpArgs.push('-o', videoPath, sourceUrl);

    this.logger.log(`Downloading video (${resolution}) from ${sourceUrl} to ${videoPath}`);

    try {
      await runCommandWithProgress('yt-dlp', ytDlpArgs, (line: string) => {
        const match = line.match(/PROGRESS\s+([\d.]+)%/);
        if (match && onProgress) onProgress(parseFloat(match[1]));
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/sign in to confirm|not a bot/i.test(message)) {
        throw new Error(
          'This video requires YouTube authentication cookies, which are missing or expired. ' +
          'Refresh YOUTUBE_COOKIES_PATH by re-exporting cookies from a logged-in browser session ' +
          '(see comment at top of video-download.service.ts for instructions).',
        );
      }
      throw err;
    }

    this.logger.log(`Extracting audio to ${audioPath}`);
    await runCommandWithProgress(
      'ffmpeg',
      ['-i', videoPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', audioPath],
      () => { },
    );

    const metadata = await this.fetchVideoMetadata(sourceUrl);

    return { videoPath, audioPath, title: metadata.title, uploader: metadata.uploader };
  }

  private async fetchVideoMetadata(sourceUrl: string): Promise<{ title: string; uploader: string }> {
    return new Promise((resolve) => {
      const ytDlpArgs = [
        '--js-runtimes', 'deno',
        '--print', '%(title)s|||%(uploader)s',
        '--skip-download',
      ];

      const cookiesPath = this.configService.get<string>('YOUTUBE_COOKIES_PATH');
      if (cookiesPath && fs.existsSync(cookiesPath)) {
        ytDlpArgs.push('--cookies', cookiesPath);
      }

      ytDlpArgs.push(sourceUrl);

      const proc = spawn('yt-dlp', ytDlpArgs);
      let output = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (output += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code !== 0) {
          this.logger.warn(`Failed to fetch video metadata: ${stderr.slice(-300)}`);
          resolve({ title: 'Untitled video', uploader: '' });
          return;
        }
        const [title, uploader] = output.trim().split('|||');
        resolve({ title: title?.trim() || 'Untitled video', uploader: uploader?.trim() || '' });
      });
      proc.on('error', (err) => {
        this.logger.warn(`Error running yt-dlp metadata fetch: ${err.message}`);
        resolve({ title: 'Untitled video', uploader: '' });
      });
    });
  }
}
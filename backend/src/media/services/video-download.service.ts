import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { UnrecoverableError } from 'bullmq';
import { SourceAuthorizationError } from '../../billing/source-authorization';

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
  constructor(
    private configService: ConfigService,
    private processRegistry: ProcessRegistryService,
  ) {}

  async downloadVideo(
    sourceUrl: string,
    outputDir: string,
    resolution: '720p' | '1080p' | '360p' | '240p',
    onProgress?: (percent: number) => void,
    maxDurationSeconds?: number,
    requirePublicAccess = false,
    deferAudioExtraction = false,
  ): Promise<{
    videoPath: string;
    audioPath: string;
    title: string;
    uploader: string;
    thumbnailUrl: string;
    duration: number;
  }> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    const videoPath = path.join(outputDir, 'source.mp4');
    const audioPath = path.join(outputDir, 'audio.wav');
    const maxHeight = Number.parseInt(resolution, 10);

    if (maxDurationSeconds || requirePublicAccess) {
      const preliminary = await this.fetchVideoMetadata(sourceUrl);
      if (
        requirePublicAccess &&
        !['public', 'unlisted'].includes(preliminary.availability || '')
      )
        throw new UnrecoverableError(
          'This source requires access that cannot be verified for your account. Use an accessible public video.',
        );
      if (!Number.isFinite(preliminary.duration) || preliminary.duration <= 0)
        throw new UnrecoverableError('Verified source duration is unavailable');
      // Fractional metadata is checked against the immutable pricing snapshot after ffprobe.
      if (
        maxDurationSeconds &&
        preliminary.duration > maxDurationSeconds &&
        (!Number.isInteger(maxDurationSeconds) ||
          preliminary.duration >= maxDurationSeconds + 1)
      )
        throw new SourceAuthorizationError(
          maxDurationSeconds,
          preliminary.duration,
        );
    }
    const ytDlpArgs = [
      '--no-playlist',
      '--socket-timeout',
      '30',
      '--js-runtimes',
      'deno',
      '-f',
      `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`,
      '--merge-output-format',
      'mp4',
      '--progress-template',
      'download:PROGRESS %(progress._percent_str)s',
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

    this.logger.log(
      `Downloading video (${resolution}) from ${sourceUrl} to ${videoPath}`,
    );

    try {
      await runCommandWithProgress(
        'yt-dlp',
        ytDlpArgs,
        (line: string) => {
          const match = line.match(/PROGRESS\s+([\d.]+)%/);
          if (match && onProgress) onProgress(parseFloat(match[1]));
        },
        this.processRegistry,
      );
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
    if (!deferAudioExtraction) await this.extractAudio(videoPath, audioPath);

    const metadata = await this.fetchVideoMetadata(sourceUrl);

    return {
      videoPath,
      audioPath,
      title: metadata.title,
      uploader: metadata.uploader,
      thumbnailUrl: metadata.thumbnailUrl,
      duration: metadata.duration,
    };
  }

  async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    await runCommandWithProgress(
      'ffmpeg',
      [
        '-i',
        videoPath,
        '-ar',
        '16000',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        '-y',
        audioPath,
      ],
      () => {},
      this.processRegistry,
    );
  }

  async canShareSource(sourceUrl: string): Promise<boolean> {
    // A server's authentication cookies must never authorize shared access for another user.
    return (await this.fetchVideoMetadata(sourceUrl, false)).duration > 0;
  }

  async fetchVideoMetadata(
    sourceUrl: string,
    useCookies = true,
  ): Promise<{
    title: string;
    uploader: string;
    thumbnailUrl: string;
    duration: number;
    availability?: string;
  }> {
    return new Promise((resolve) => {
      const ytDlpArgs = [
        '--no-playlist',
        '--socket-timeout',
        '15',
        '--retries',
        '1',
        '--js-runtimes',
        'deno',
        '--print',
        '%(title)s|||%(uploader)s|||%(thumbnail)s|||%(duration)s|||%(availability)s',
        '--skip-download',
      ];
      if (!useCookies) ytDlpArgs.unshift('--ignore-config');

      const cookiesPath = this.configService.get<string>(
        'YOUTUBE_COOKIES_PATH',
      );
      if (useCookies && cookiesPath && fs.existsSync(cookiesPath)) {
        ytDlpArgs.push('--cookies', cookiesPath);
      }

      ytDlpArgs.push(sourceUrl);

      const proc = spawn('yt-dlp', ytDlpArgs, {
        detached: true,
        windowsHide: true,
      });
      const timeout = setTimeout(() => {
        try {
          if (process.platform !== 'win32' && proc.pid) {
            process.kill(-proc.pid, 'SIGKILL');
          } else {
            proc.kill('SIGKILL');
          }
        } catch {
          // The subprocess may already have exited.
        }
        resolve({
          title: 'Untitled video',
          uploader: '',
          thumbnailUrl: '',
          duration: 0,
        });
      }, 30000);
      proc.once('close', () => clearTimeout(timeout));
      proc.once('error', () => clearTimeout(timeout));
      this.processRegistry.register(proc);

      let output = '';
      let stderr = '';
      proc.stdout?.on(
        'data',
        (d) => (output = (output + d.toString()).slice(-65536)),
      );
      proc.stderr?.on(
        'data',
        (d) => (stderr = (stderr + d.toString()).slice(-4096)),
      );
      proc.on('close', (code) => {
        if (code !== 0) {
          this.logger.warn(
            `Failed to fetch video metadata: ${stderr.slice(-300)}`,
          );
          resolve({
            title: 'Untitled video',
            uploader: '',
            thumbnailUrl: '',
            duration: 0,
          });
          return;
        }
        const [title, uploader, thumbnail, durationStr, availability] = output
          .trim()
          .split('|||');
        const duration = parseFloat(durationStr) || 0;
        resolve({
          title: title?.trim() || 'Untitled video',
          uploader: uploader?.trim() || '',
          thumbnailUrl: thumbnail?.trim() || '',
          duration,
          availability: availability?.trim(),
        });
      });
      proc.on('error', (err) => {
        this.logger.warn(`Error running yt-dlp metadata fetch: ${err.message}`);
        resolve({
          title: 'Untitled video',
          uploader: '',
          thumbnailUrl: '',
          duration: 0,
        });
      });
    });
  }
}

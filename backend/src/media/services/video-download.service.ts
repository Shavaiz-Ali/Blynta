import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

@Injectable()
export class VideoDownloadService {
  private readonly logger = new Logger(VideoDownloadService.name);
  constructor(private configService: ConfigService) {}

  async downloadVideo(sourceUrl: string, outputDir: string): Promise<{ videoPath: string; audioPath: string }> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    const videoPath = path.join(outputDir, 'source.mp4');
    const audioPath = path.join(outputDir, 'audio.wav');

    this.logger.log(`Downloading video from ${sourceUrl} to ${videoPath}`);
    await this.runCommand('yt-dlp', [
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      '--merge-output-format', 'mp4',
      '-o', videoPath,
      sourceUrl,
    ]);

    this.logger.log(`Extracting audio to ${audioPath}`);
    await this.runCommand('ffmpeg', [
      '-i', videoPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      audioPath,
    ]);

    return { videoPath, audioPath };
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ${command}: ${err.message}`));
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  }
}

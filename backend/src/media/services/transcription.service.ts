import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { spawn } from 'child_process';

export interface TranscriptSegmentDto {
  startTime: number;
  endTime: number;
  text: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperBinaryPath: string | undefined;
  private readonly whisperModelPath: string | undefined;

  constructor(private configService: ConfigService) {
    this.whisperBinaryPath = this.configService.get<string>('WHISPER_BINARY_PATH');
    this.whisperModelPath = this.configService.get<string>('WHISPER_MODEL_PATH');
  }

  async transcribe(audioPath: string): Promise<TranscriptSegmentDto[]> {
    if (!this.whisperBinaryPath || !this.whisperModelPath) {
      throw new Error('WHISPER_BINARY_PATH or WHISPER_MODEL_PATH is not configured');
    }

    const outputBase = audioPath.replace(/\.wav$/, '');
    this.logger.log(`Transcribing ${audioPath} with whisper.cpp`);

    const binary = this.whisperBinaryPath;
    await this.runWhisper(binary, [
      '-m', this.whisperModelPath,
      '-f', audioPath,
      '-oj',
      '-of', outputBase,
      '-l', 'auto',
    ]);

    const jsonPath = `${outputBase}.json`;
    const rawJson = await fs.promises.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(rawJson);

    return this.parseWhisperOutput(parsed);
  }

  private parseWhisperOutput(parsed: any): TranscriptSegmentDto[] {
    const segments = parsed.transcription || parsed.segments || [];
    return segments.map((seg: any) => {
      let startTime: number;
      let endTime: number;
      let text: string;

      if (seg.offsets && typeof seg.offsets.from === 'number') {
        startTime = seg.offsets.from / 1000;
        endTime = seg.offsets.to / 1000;
      } else if (typeof seg.t0 === 'number' && typeof seg.t1 === 'number') {
        startTime = seg.t0 / 1000;
        endTime = seg.t1 / 1000;
      } else if (typeof seg.start === 'number' && typeof seg.end === 'number') {
        startTime = seg.start;
        endTime = seg.end;
      } else {
        startTime = 0;
        endTime = 0;
      }

      text = (seg.text || '').trim();
      return { startTime, endTime, text };
    });
  }

  private runWhisper(binary: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.stdout.on('data', () => {});
      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn whisper.cpp: ${err.message}`));
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`whisper.cpp exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  }
}

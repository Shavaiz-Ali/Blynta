import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { runCommandWithProgress } from '../utils/run-command-with-progress';

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

  async transcribe(
    audioPath: string,
    onProgress?: (percent: number) => void,
  ): Promise<TranscriptSegmentDto[]> {
    if (!this.whisperBinaryPath || !this.whisperModelPath) {
      throw new Error('WHISPER_BINARY_PATH or WHISPER_MODEL_PATH is not configured');
    }

    const outputBase = audioPath.replace(/\.wav$/, '');
    this.logger.log(`Transcribing ${audioPath} with whisper.cpp`);

    const binary = this.whisperBinaryPath;
    await runCommandWithProgress(
      binary,
      [
        '-m', this.whisperModelPath,
        '-f', audioPath,
        '-oj',
        '-of', outputBase,
        '-l', 'auto',
      ],
      (line: string) => {
        const match = line.match(/progress\s*=\s*(\d+)%/);
        if (match && onProgress) onProgress(parseInt(match[1], 10));
      },
    );

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
}

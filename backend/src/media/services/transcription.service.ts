import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

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

  constructor(
    private configService: ConfigService,
    private processRegistry: ProcessRegistryService,
  ) {
    this.whisperBinaryPath = this.configService.get<string>('WHISPER_BINARY_PATH');
    this.whisperModelPath = this.configService.get<string>('WHISPER_MODEL_PATH');
  }

  /**
   * @param initialPrompt Optional vocabulary hint passed to whisper (e.g. show
   *   name, speaker names, recurring proper nouns). Whisper leans heavily on
   *   this to disambiguate phonetically-similar words — this is the single
   *   biggest lever for fixing misspelled names/titles beyond model size.
   */
  async transcribe(
    audioPath: string,
    onProgress?: (percent: number) => void,
    initialPrompt?: string,
  ): Promise<TranscriptSegmentDto[]> {
    if (!this.whisperBinaryPath || !this.whisperModelPath) {
      throw new Error('WHISPER_BINARY_PATH or WHISPER_MODEL_PATH is not configured');
    }

    const outputBase = audioPath.replace(/\.wav$/, '');
    this.logger.log(`Transcribing ${audioPath} with whisper.cpp (model=${this.whisperModelPath})`);

    const binary = this.whisperBinaryPath;
    const args = [
      '-m', this.whisperModelPath,
      '-f', audioPath,
      '-oj',
      '-of', outputBase,
      '-l', 'auto',
      '-pp',
      '--best-of', '5',
      '--beam-size', '5',
    ];

    if (initialPrompt) {
      args.push('--prompt', initialPrompt);
    }

    await runCommandWithProgress(
      binary,
      args,
      (line: string) => {
        const match = line.match(/progress\s*=\s*(\d+)%/);
        if (match && onProgress) onProgress(parseInt(match[1], 10));
      },
      this.processRegistry,
    );

    const candidatePaths = [
      `${outputBase}.json`,
      `${audioPath}.json`,
      `${outputBase}.wav.json`,
      `${audioPath}.wav.json`,
    ];

    let jsonPath: string | undefined;
    for (const candidate of candidatePaths) {
      try {
        await fs.promises.access(candidate);
        jsonPath = candidate;
        break;
      } catch {
        // continue
      }
    }

    if (!jsonPath) {
      const dir = path.dirname(audioPath);
      try {
        const files = await fs.promises.readdir(dir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        if (jsonFile) {
          jsonPath = path.join(dir, jsonFile);
        }
      } catch {
        // ignore
      }
    }

    if (!jsonPath) {
      throw new Error(`Whisper transcription finished but no output JSON file was found at ${outputBase}.json`);
    }

    this.logger.log(`Reading whisper output from ${jsonPath}`);
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
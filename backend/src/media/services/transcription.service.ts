import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

export interface TranscriptSegmentDto {
  startTime: number;
  endTime: number;
  text: string;
}

const GROQ_MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const COMPRESSED_BITRATE_KBPS = 48; // mono speech at 48kbps stays well under limit for long files

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly provider: string;
  private readonly groq?: Groq;
  private readonly modelName?: string;
  private readonly whisperBinaryPath?: string;
  private readonly whisperModelPath?: string;

  constructor(
    private configService: ConfigService,
    private processRegistry: ProcessRegistryService,
  ) {
    this.provider = this.configService.get<string>('TRANSCRIPTION_PROVIDER', 'groq');
    if (this.provider === 'groq') {
      const apiKey = this.configService.get<string>('GROQ_API_KEY');
      if (!apiKey) {
        throw new Error('GROQ_API_KEY is not configured but TRANSCRIPTION_PROVIDER=groq');
      }
      this.groq = new Groq({ apiKey });
      this.modelName = this.configService.get<string>('GROQ_WHISPER_MODEL', 'whisper-large-v3-turbo');
    } else if (this.provider === 'whisper-cpp') {
      this.whisperBinaryPath = this.configService.get<string>('WHISPER_BINARY_PATH');
      this.whisperModelPath = this.configService.get<string>('WHISPER_MODEL_PATH');
      if (!this.whisperBinaryPath || !this.whisperModelPath) {
        throw new Error(
          'WHISPER_BINARY_PATH or WHISPER_MODEL_PATH is not configured when TRANSCRIPTION_PROVIDER=whisper-cpp',
        );
      }
    } else {
      throw new Error(`Unknown TRANSCRIPTION_PROVIDER: ${this.provider}`);
    }
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
    return this.provider === 'groq'
      ? this.transcribeWithGroq(audioPath, onProgress, initialPrompt)
      : this.transcribeWithWhisperCpp(audioPath, onProgress, initialPrompt);
  }

  private async transcribeWithGroq(
    audioPath: string,
    onProgress?: (percent: number) => void,
    initialPrompt?: string,
  ): Promise<TranscriptSegmentDto[]> {
    this.logger.log(`Transcribing ${audioPath} with Groq (model=${this.modelName})`);

    const { uploadPath, isTemp } = await this.prepareAudioForUpload(audioPath);
    const stopProgressSimulation = this.simulateProgress(audioPath, onProgress);

    try {
      const transcription = await this.groq!.audio.transcriptions.create({
        file: fs.createReadStream(uploadPath),
        model: this.modelName!,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        prompt: initialPrompt,
        language: undefined, // let Groq auto-detect; set explicitly later if you want to force a language
      });

      onProgress?.(100);
      return this.parseGroqOutput(transcription);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Groq transcription failed: ${message}`);
      throw new Error(`Groq transcription failed: ${message}`);
    } finally {
      stopProgressSimulation();
      if (isTemp) {
        try {
          await fs.promises.unlink(uploadPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to clean up compressed audio file: ${message}`);
        }
      }
    }
  }

  private async prepareAudioForUpload(audioPath: string): Promise<{ uploadPath: string; isTemp: boolean }> {
    const stats = await fs.promises.stat(audioPath);
    if (stats.size <= GROQ_MAX_FILE_BYTES) {
      return { uploadPath: audioPath, isTemp: false };
    }

    const compressedPath = audioPath.replace(/\.wav$/, '-compressed.mp3');
    this.logger.log(
      `Audio file ${audioPath} is ${(stats.size / 1024 / 1024).toFixed(1)}MB, exceeding Groq's 25MB limit — compressing to MP3`,
    );

    await runCommandWithProgress(
      'ffmpeg',
      ['-i', audioPath, '-b:a', `${COMPRESSED_BITRATE_KBPS}k`, '-y', compressedPath],
      () => {},
      this.processRegistry,
    );

    const compressedStats = await fs.promises.stat(compressedPath);
    if (compressedStats.size > GROQ_MAX_FILE_BYTES) {
      // Extremely long audio even at 48kbps can still exceed 25MB (roughly >69
      // minutes at this bitrate) — drop bitrate further as a fallback rather
      // than failing outright.
      this.logger.warn(
        `Compressed file still ${(compressedStats.size / 1024 / 1024).toFixed(1)}MB — retrying at lower bitrate (24k)`,
      );
      await runCommandWithProgress(
        'ffmpeg',
        ['-i', audioPath, '-b:a', '24k', '-y', compressedPath],
        () => {},
        this.processRegistry,
      );
    }

    return { uploadPath: compressedPath, isTemp: true };
  }

  private async getAudioDurationSeconds(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
      const proc = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        audioPath,
      ]);
      this.processRegistry.register(proc);

      let output = '';
      proc.stdout?.on('data', (d) => (output += d.toString()));
      proc.on('close', () => {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      });
      proc.on('error', () => resolve(0)); // duration unknown — simulation just won't run, real 0->100 jump happens instead
    });
  }

  /**
   * Returns a stop function — call it in a `finally` block to clear the interval
   * regardless of success/failure.
   */
  private simulateProgress(
    audioPath: string,
    onProgress?: (percent: number) => void,
  ): () => void {
    if (!onProgress) return () => {};

    let cancelled = false;
    let intervalId: NodeJS.Timeout | undefined;

    this.getAudioDurationSeconds(audioPath).then((durationSeconds) => {
      if (cancelled || durationSeconds <= 0) return;

      // Conservative estimate: assume 150x real-time (below Groq's published
      // 228x) to avoid the simulated bar racing ahead of the actual response.
      const estimatedTotalMs = Math.max(1500, (durationSeconds / 150) * 1000);
      const tickIntervalMs = 300;
      const maxSimulatedPercent = 92; // never claim done until the real result lands
      let elapsedMs = 0;

      onProgress(2); // immediate feedback that the request started
      intervalId = setInterval(() => {
        elapsedMs += tickIntervalMs;
        const simulated = Math.min(maxSimulatedPercent, Math.round((elapsedMs / estimatedTotalMs) * 100));
        onProgress(simulated);
      }, tickIntervalMs);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }

  private parseGroqOutput(transcription: any): TranscriptSegmentDto[] {
    // verbose_json response shape: { text, segments: [{ start, end, text, ... }], ... }
    const segments = transcription.segments || [];
    if (segments.length === 0 && transcription.text) {
      // Fallback: some responses may omit segment-level timestamps for very
      // short audio — return one segment spanning the whole thing rather
      // than silently dropping the transcript.
      this.logger.warn('Groq response had no segment timestamps — returning single full-text segment');
      return [{ startTime: 0, endTime: 0, text: transcription.text.trim() }];
    }
    return segments.map((seg: any) => ({
      startTime: seg.start,
      endTime: seg.end,
      text: (seg.text || '').trim(),
    }));
  }

  private async transcribeWithWhisperCpp(
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
      '-m',
      this.whisperModelPath,
      '-f',
      audioPath,
      '-oj',
      '-of',
      outputBase,
      '-l',
      'auto',
      '-pp',
      '--best-of',
      '5',
      '--beam-size',
      '5',
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
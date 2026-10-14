import { usageSample } from '../../billing/usage-context';
import { artifactHash, TRANSCRIPT_VERSION } from '../pipeline-cache-identity';
import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import {
  assertTranscript,
  normalizeTranscriptResponse,
  TranscriptValidationError,
} from '../transcript-validation';
import {
  cancellationSignal,
  assertNotCancelled,
} from '../../jobs/cancellation-context';
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
  private readonly fileVersions = new Map<
    string,
    { stamp: string; digest: Promise<string> }
  >();

  constructor(
    private configService: ConfigService,
    private processRegistry: ProcessRegistryService,
  ) {
    this.provider = this.configService.get<string>(
      'TRANSCRIPTION_PROVIDER',
      'groq',
    );
    if (this.provider === 'groq') {
      const apiKey = this.configService.get<string>('GROQ_API_KEY');
      if (!apiKey) {
        throw new Error(
          'GROQ_API_KEY is not configured but TRANSCRIPTION_PROVIDER=groq',
        );
      }
      this.groq = new Groq({ apiKey });
      this.modelName = this.configService.get<string>(
        'GROQ_WHISPER_MODEL',
        'whisper-large-v3-turbo',
      );
    } else if (this.provider === 'whisper-cpp') {
      this.whisperBinaryPath = this.configService.get<string>(
        'WHISPER_BINARY_PATH',
      );
      this.whisperModelPath =
        this.configService.get<string>('WHISPER_MODEL_PATH');
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
  async cacheConfiguration(): Promise<string> {
    // Local model contents, rather than just a reusable filename, define compatibility.
    let model: string | undefined = this.modelName;
    let binary: string | undefined;
    if (this.whisperModelPath) {
      model = await this.fileVersion(this.whisperModelPath);
    }
    if (this.whisperBinaryPath) {
      binary = await this.fileVersion(this.whisperBinaryPath);
    }
    return artifactHash({
      version: TRANSCRIPT_VERSION,
      provider: this.provider,
      model,
      binary,
      decoder:
        this.provider === 'whisper-cpp'
          ? { bestOf: 5, beamSize: 5, output: 'json' }
          : { output: 'verbose_json' },
      language: 'auto',
      timestamps: 'segment',
      sampleRate: 16000,
      channels: 1,
      initialPrompt: null,
      compressionBitrate: COMPRESSED_BITRATE_KBPS,
    });
  }

  private async fileVersion(file: string): Promise<string> {
    const stampOf = async () => {
      const stat = await fs.promises.stat(file, { bigint: true });
      return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(
        ':',
      );
    };
    const stamp = await stampOf();
    const cached = this.fileVersions.get(file);
    if (cached?.stamp === stamp) return cached.digest;
    const digest = (async () => {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file))
        hash.update(chunk as Buffer);
      if ((await stampOf()) !== stamp)
        throw new Error(
          'Transcription model changed while fingerprinting; retry with a stable model',
        );
      return hash.digest('hex');
    })();
    this.fileVersions.set(file, { stamp, digest });
    try {
      return await digest;
    } catch (error) {
      if (this.fileVersions.get(file)?.digest === digest)
        this.fileVersions.delete(file);
      throw error;
    }
  }

  async transcribe(
    audioPath: string,
    onProgress?: (percent: number) => void,
    initialPrompt?: string,
    verifiedDuration?: number,
  ): Promise<TranscriptSegmentDto[]> {
    const startedAt = Date.now();
    try {
      const duration =
        verifiedDuration ?? (await this.getAudioDurationSeconds(audioPath));
      assertNotCancelled();
      if (!Number.isFinite(duration) || duration <= 0)
        throw new TranscriptValidationError({
          reason: 'invalid_media_duration',
        });
      const result = await (this.provider === 'groq'
        ? this.transcribeWithGroq(
            audioPath,
            onProgress,
            initialPrompt,
            duration,
          )
        : this.transcribeWithWhisperCpp(
            audioPath,
            onProgress,
            initialPrompt,
            duration,
          ));
      assertTranscript(result, duration);
      await usageSample('transcription', {
        provider: this.provider,
        model: this.modelName || this.whisperModelPath,
        audioDurationSeconds: duration,
        // Transcript end is recorded separately; verified audio duration is supplied by the operation.
        transcriptEndSeconds: result.length
          ? Math.max(...result.map((s) => s.endTime))
          : 0,
        wallSeconds: (Date.now() - startedAt) / 1000,
      });
      return result;
    } catch (error) {
      if (error instanceof TranscriptValidationError)
        this.logger.warn({
          event: 'transcript.validation_failed',
          provider: this.provider,
          code: error.code,
          ...error.details,
        });
      await usageSample('transcription', {
        provider: this.provider,
        model: this.modelName,
        failed: true,
        wallSeconds: (Date.now() - startedAt) / 1000,
      });
      throw error;
    }
  }

  private async transcribeWithGroq(
    audioPath: string,
    onProgress?: (percent: number) => void,
    initialPrompt?: string,
    duration = 0,
  ): Promise<TranscriptSegmentDto[]> {
    this.logger.log(
      `Transcribing ${audioPath} with Groq (model=${this.modelName})`,
    );

    const { uploadPath, isTemp } = await this.prepareAudioForUpload(audioPath);
    const stopProgressSimulation = this.simulateProgress(audioPath, onProgress);
    const audioStream = fs.createReadStream(uploadPath);
    const audioClosed = new Promise<void>((resolve) =>
      audioStream.once('close', resolve),
    );

    try {
      const transcription = await this.groq!.audio.transcriptions.create(
        {
          file: audioStream,
          model: this.modelName!,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
          prompt: initialPrompt,
          language: undefined, // let Groq auto-detect; set explicitly later if you want to force a language
        },
        { signal: cancellationSignal() },
      );

      assertNotCancelled();
      onProgress?.(100);
      const response = transcription as unknown as Record<string, unknown>;
      if (
        (response.segments === undefined ||
          (Array.isArray(response.segments) && !response.segments.length)) &&
        typeof response.text === 'string' &&
        response.text.trim()
      )
        this.logger.warn({
          event: 'transcript.coarse_timing',
          provider: 'groq',
          durationSeconds: duration,
        });
      return normalizeTranscriptResponse('groq', transcription, duration);
    } catch (err) {
      assertNotCancelled();
      if (err instanceof TranscriptValidationError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Groq transcription failed: ${message}`);
      throw new Error(`Groq transcription failed: ${message}`);
    } finally {
      stopProgressSimulation();
      audioStream.destroy();
      await audioClosed;
      if (isTemp) {
        try {
          await fs.promises.unlink(uploadPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to clean up compressed audio file: ${message}`,
          );
        }
      }
    }
  }

  private async prepareAudioForUpload(
    audioPath: string,
  ): Promise<{ uploadPath: string; isTemp: boolean }> {
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
      [
        '-i',
        audioPath,
        '-b:a',
        `${COMPRESSED_BITRATE_KBPS}k`,
        '-y',
        compressedPath,
      ],
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
      proc.stdout?.on('data', (d: Buffer) => (output += d.toString()));
      proc.on('close', (code) => {
        const duration = parseFloat(output.trim());
        resolve(
          code === 0 && Number.isFinite(duration) && duration > 0
            ? duration
            : 0,
        );
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

    void this.getAudioDurationSeconds(audioPath).then((durationSeconds) => {
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
        const simulated = Math.min(
          maxSimulatedPercent,
          Math.round((elapsedMs / estimatedTotalMs) * 100),
        );
        onProgress(simulated);
      }, tickIntervalMs);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }

  private async transcribeWithWhisperCpp(
    audioPath: string,
    onProgress?: (percent: number) => void,
    initialPrompt?: string,
    duration = 0,
  ): Promise<TranscriptSegmentDto[]> {
    if (!this.whisperBinaryPath || !this.whisperModelPath) {
      throw new Error(
        'WHISPER_BINARY_PATH or WHISPER_MODEL_PATH is not configured',
      );
    }

    // An invocation owns its output. Never read a previous or unrelated JSON file.
    const outputBase = path.join(
      path.dirname(audioPath),
      `transcript-${randomUUID()}`,
    );
    this.logger.log(
      `Transcribing ${audioPath} with whisper.cpp (model=${this.whisperModelPath})`,
    );

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

    try {
      await runCommandWithProgress(
        binary,
        args,
        (line: string) => {
          const match = line.match(/progress\s*=\s*(\d+)%/);
          if (match && onProgress) onProgress(parseInt(match[1], 10));
        },
        this.processRegistry,
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(
          await fs.promises.readFile(`${outputBase}.json`, 'utf-8'),
        );
      } catch {
        throw new TranscriptValidationError({
          reason: 'missing_or_malformed_provider_output',
        });
      }
      return normalizeTranscriptResponse('whisper-cpp', parsed, duration);
    } finally {
      await fs.promises.unlink(`${outputBase}.json`).catch(() => undefined);
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, normalize, resolve } from 'path';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import {
  assertNotCancelled,
  cancellationSignal,
  trackCancellableProcess,
} from '../../jobs/cancellation-context';
import { hostCommand } from '../utils/host-command';

/** One face from MediaPipe — normalized coordinates (0–1). */
export interface DetectedFace {
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

/** Detection results for a single sampled frame. */
export interface DetectionFrame {
  timestamp: number;
  faces: DetectedFace[];
}

/** Full detection result for a source video. */
export interface VideoFaceDetection {
  frames: DetectionFrame[];
  sourceWidth: number;
  sourceHeight: number;
}

interface CacheEntry {
  /** Promise resolves to null on failure (never rejects). */
  result: Promise<VideoFaceDetection | null>;
  createdAt: number;
  lastAccessedAt: number;
}

/** Default TTL for cached detection results (30 minutes). */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Default max number of video detection results in memory (LRU). */
const DEFAULT_MAX_CACHE_ENTRIES = 5;

/**
 * Runs the standalone Python MediaPipe face-detection service and caches
 * results per source-video path using LRU eviction and concurrency throttling.
 *
 * Integrates with:
 * - hostCommand() concurrency lock (preventing CPU/memory starvation with FFmpeg)
 * - ProcessRegistryService & cancellationSignal (preventing orphan background processes)
 * - Dynamic duration-aware timeout with graceful termination escalation
 *
 * Never throws — always returns null on any failure so the render pipeline
 * can fall back to its existing center-crop behaviour.
 */
@Injectable()
export class FaceDetectionService implements OnModuleDestroy {
  private readonly logger = new Logger(FaceDetectionService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /** Absolute path to the face-detection service root. */
  private readonly serviceRoot: string;
  /** Python executable (configurable via FACE_DETECTION_PYTHON env var). */
  private readonly python: string;
  /** Model file path (configurable via FACE_DETECTION_MODEL env var). */
  private readonly modelPath: string;
  /** Sampling interval in seconds (configurable via FACE_DETECTION_INTERVAL). */
  private readonly interval: number;
  /** Confidence threshold (configurable via FACE_DETECTION_CONFIDENCE). */
  private readonly confidence: number;
  /** Explicit timeout override in milliseconds (if configured). */
  private readonly configuredTimeoutMs?: number;
  /** Maximum number of video detections cached in memory. */
  private readonly maxCacheEntries: number;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly processRegistry?: ProcessRegistryService,
  ) {
    // Robust root discovery: accounts for dist/ vs src/ and varying CWD.
    const candidates = [
      resolve(__dirname, '..', '..', '..', '..', 'services', 'face-detection'),
      resolve(__dirname, '..', '..', '..', 'services', 'face-detection'),
      resolve(process.cwd(), 'services', 'face-detection'),
      resolve(process.cwd(), 'backend', 'services', 'face-detection'),
    ];
    this.serviceRoot =
      candidates.find((p) => existsSync(p)) ?? candidates[0];

    const venvPython =
      process.platform === 'win32'
        ? join(this.serviceRoot, '.venv', 'Scripts', 'python.exe')
        : join(this.serviceRoot, '.venv', 'bin', 'python');

    const defaultPython = existsSync(venvPython)
      ? venvPython
      : process.platform === 'win32'
        ? 'python'
        : 'python3';

    const rawPython = config.get<string>('FACE_DETECTION_PYTHON', defaultPython);
    this.python = rawPython ? normalize(rawPython) : 'python3';

    const rawModel = config.get<string>(
      'FACE_DETECTION_MODEL',
      join(this.serviceRoot, 'models', 'blaze_face_short_range.tflite'),
    );
    this.modelPath = rawModel ? normalize(rawModel) : '';

    this.interval = Number(config.get<string>('FACE_DETECTION_INTERVAL', '1'));
    this.confidence = Number(
      config.get<string>('FACE_DETECTION_CONFIDENCE', '0.5'),
    );

    const envTimeout = config.get<string>('FACE_DETECTION_TIMEOUT_MS');
    if (envTimeout) {
      this.configuredTimeoutMs = Number(envTimeout);
    }

    this.maxCacheEntries = Number(
      config.get<string>(
        'FACE_DETECTION_MAX_CACHE_ENTRIES',
        String(DEFAULT_MAX_CACHE_ENTRIES),
      ),
    );
  }

  /**
   * Detect faces in a local video file.
   *
   * Results are cached by absolute path with LRU eviction. Concurrent callers
   * for the same path share one subprocess invocation.
   *
   * @param videoPath Local filesystem path to the video file.
   * @param durationSeconds Optional duration in seconds used for duration-aware timeout.
   * @returns Parsed detection data or null on any error.
   */
  detect(videoPath: string, durationSeconds?: number): Promise<VideoFaceDetection | null> {
    const absPath = resolve(videoPath);
    this.evictExpired();

    let entry = this.cache.get(absPath);
    if (entry) {
      // LRU refresh: re-insert at end of Map
      entry.lastAccessedAt = Date.now();
      this.cache.delete(absPath);
      this.cache.set(absPath, entry);
      return entry.result;
    }

    // LRU eviction if cache size reaches limit
    this.ensureCacheCapacity();

    const resultPromise = this.run(absPath, durationSeconds);
    entry = {
      result: resultPromise,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    this.cache.set(absPath, entry);

    return resultPromise;
  }

  /** Invalidate any cached detection for a given path (e.g. after source cleanup). */
  invalidate(videoPath: string): void {
    this.cache.delete(resolve(videoPath));
  }

  onModuleDestroy(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async run(
    absPath: string,
    durationSeconds?: number,
  ): Promise<VideoFaceDetection | null> {
    // Check cancellation and process registry health before launching
    this.processRegistry?.assertRunning();
    assertNotCancelled();

    const args = [
      '-m',
      'src.main',
      'video',
      '--input',
      absPath,
      '--interval',
      String(this.interval),
      '--confidence',
      String(this.confidence),
      '--model',
      this.modelPath,
    ];

    // Compute duration-aware timeout:
    // Inference speed is ~50ms/frame on CPU. At 1s intervals, 3600s video = 3600 frames = ~180s.
    // We allocate 2.5x estimated time with minimum 120s and maximum 1800s (30m).
    const estimatedTimeoutMs = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.ceil(durationSeconds * 500)
      : 180_000;
    const timeoutMs =
      this.configuredTimeoutMs ??
      Math.min(1800_000, Math.max(120_000, estimatedTimeoutMs));

    this.logger.log(
      `[face-detection] Starting detection: ${absPath} (interval=${this.interval}s, timeout=${timeoutMs}ms)`,
    );

    // Concurrency throttling: route through hostCommand to share slots with FFmpeg/Whisper
    const limited = hostCommand(this.python, args);

    return new Promise<VideoFaceDetection | null>((resolve) => {
      let stdout = '';
      let timedOut = false;
      let closed = false;

      let proc: ReturnType<typeof spawn>;
      try {
        proc = spawn(limited.command, limited.args, {
          cwd: this.serviceRoot,
          windowsHide: true,
          detached: process.platform !== 'win32',
          env: limited.env,
        });
      } catch (err) {
        this.logger.warn(
          `[face-detection] Failed to spawn Python subprocess: ${err}`,
        );
        resolve(null);
        return;
      }

      // Register with ProcessRegistry and BullMQ cancellation tracking
      this.processRegistry?.register(proc);
      trackCancellableProcess(proc);

      // Handle cancellation abort
      const signal = cancellationSignal();
      const onAbort = () => {
        if (!closed) {
          this.logger.warn(
            `[face-detection] Cancellation requested; terminating PID ${proc.pid}`,
          );
          this.terminateSubprocess(proc);
        }
      };
      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener('abort', onAbort, { once: true });
      }

      // Duration-aware timeout timer
      const timer = setTimeout(() => {
        if (closed) return;
        timedOut = true;
        this.logger.warn(
          `[face-detection] Subprocess PID ${proc.pid} timed out after ${timeoutMs}ms, terminating`,
        );
        this.terminateSubprocess(proc);
      }, timeoutMs);
      timer.unref?.();

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) this.logger.debug(`[face-detection:stderr] ${text}`);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.logger.warn(`[face-detection] Subprocess error: ${err}`);
        resolve(null);
      });

      proc.on('close', (code) => {
        closed = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);

        if (timedOut || signal?.aborted) {
          resolve(null);
          return;
        }

        if (code !== 0) {
          this.logger.warn(
            `[face-detection] Subprocess exited with code ${code}`,
          );
          resolve(null);
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!parsed.success) {
            this.logger.warn(
              `[face-detection] Service returned error: ${parsed.error}`,
            );
            resolve(null);
            return;
          }
          const result = this.normalize(parsed);
          this.logger.log(
            `[face-detection] Done: ${result.frames.length} frames sampled, ` +
              `source=${result.sourceWidth}x${result.sourceHeight}`,
          );
          resolve(result);
        } catch (err) {
          this.logger.warn(
            `[face-detection] Failed to parse JSON output: ${err}`,
          );
          resolve(null);
        }
      });
    });
  }

  /**
   * Safely terminates child process with SIGTERM and escalates to SIGKILL if still running.
   */
  private terminateSubprocess(proc: ChildProcess): void {
    if (!proc.pid) return;

    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
          windowsHide: true,
          timeout: 2000,
          stdio: 'ignore',
        });
      } else {
        process.kill(-proc.pid, 'SIGTERM');
      }
    } catch {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* already dead */
      }
    }

    // Force kill escalation after 3 seconds if not closed
    const escalation = setTimeout(() => {
      try {
        if (process.platform !== 'win32' && proc.pid) {
          process.kill(-proc.pid, 'SIGKILL');
        } else {
          proc.kill('SIGKILL');
        }
      } catch {
        /* already dead */
      }
    }, 3000);
    escalation.unref?.();
  }

  /**
   * Maps raw CLI JSON output to VideoFaceDetection.
   * Strips raw facial keypoints and diagnostic arrays to keep memory minimal.
   */
  private normalize(raw: Record<string, unknown>): VideoFaceDetection {
    const metadata = raw.metadata as Record<string, unknown>;
    const sourceWidth = Number((metadata?.width as number) ?? 1920);
    const sourceHeight = Number((metadata?.height as number) ?? 1080);

    const frames: DetectionFrame[] = [];
    const rawFrames = (raw.frames as Record<string, unknown>[]) ?? [];

    for (const f of rawFrames) {
      const rawFaces = (f.faces as Record<string, unknown>[]) ?? [];
      const faces: DetectedFace[] = rawFaces.map((face) => {
        const bb = face.boundingBox as Record<string, number>;
        return {
          confidence: Number(face.confidence ?? 0),
          boundingBox: {
            x: Number(bb?.x ?? 0),
            y: Number(bb?.y ?? 0),
            width: Number(bb?.width ?? 0),
            height: Number(bb?.height ?? 0),
          },
        };
      });
      frames.push({ timestamp: Number(f.timestamp ?? 0), faces });
    }

    return { frames, sourceWidth, sourceHeight };
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > CACHE_TTL_MS) this.cache.delete(key);
    }
  }

  private ensureCacheCapacity(): void {
    while (this.cache.size >= this.maxCacheEntries) {
      // Evict oldest (least recently used) entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }
}

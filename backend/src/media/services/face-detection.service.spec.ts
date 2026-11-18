import { FaceDetectionService } from './face-detection.service';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { normalize } from 'path';
import { EventEmitter } from 'events';
import { hostCommand } from '../utils/host-command';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { mediaExecution } from '../../jobs/cancellation-context';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../utils/host-command', () => ({
  hostCommand: jest.fn((cmd: string, args: string[]) => ({
    command: cmd,
    args,
    env: process.env,
  })),
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockHostCommand = hostCommand as jest.MockedFunction<typeof hostCommand>;

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, fallback?: string) => overrides[key] ?? fallback,
  } as unknown as ConfigService;
}

function makeFakeProc(options: {
  stdout?: string;
  exitCode?: number;
  spawnError?: Error;
  delayMs?: number;
}) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.pid = 12345;
  proc.kill = jest.fn();

  if (options.spawnError) {
    setImmediate(() => proc.emit('error', options.spawnError));
  } else {
    setTimeout(() => {
      if (options.stdout !== undefined) {
        stdout.emit('data', Buffer.from(options.stdout));
      }
      proc.emit('close', options.exitCode ?? 0);
    }, options.delayMs ?? 10);
  }
  return proc;
}

const SUCCESS_PAYLOAD = JSON.stringify({
  success: true,
  metadata: { width: 1920, height: 1080 },
  frames: [
    {
      timestamp: 0,
      faces: [
        {
          confidence: 0.95,
          boundingBox: { x: 0.4, y: 0.1, width: 0.2, height: 0.4 },
          keypoints: [{ x: 0.45, y: 0.2 }], // should be stripped in normalize
        },
      ],
    },
  ],
});

describe('FaceDetectionService', () => {
  let service: FaceDetectionService;
  let registry: ProcessRegistryService;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = {
      assertRunning: jest.fn(),
      register: jest.fn(),
    } as unknown as ProcessRegistryService;
    service = new FaceDetectionService(makeConfig(), registry);
  });

  it('routes execution through hostCommand and registers process', async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProc({ stdout: SUCCESS_PAYLOAD }) as any);
    const result = await service.detect('/tmp/video.mp4', 120);

    expect(result).not.toBeNull();
    expect(mockHostCommand).toHaveBeenCalledWith(
      expect.stringContaining('python'),
      expect.arrayContaining(['-m', 'src.main', 'video']),
    );
    expect(registry.assertRunning).toHaveBeenCalled();
    expect(registry.register).toHaveBeenCalled();
  });

  it('strips unnecessary metadata and keypoints in normalization', async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProc({ stdout: SUCCESS_PAYLOAD }) as any);
    const result = await service.detect('/tmp/video.mp4');

    expect(result).not.toBeNull();
    expect(result!.sourceWidth).toBe(1920);
    expect(result!.sourceHeight).toBe(1080);
    expect(result!.frames[0].faces[0].confidence).toBeCloseTo(0.95);
    // Keypoints should NOT be present on DetectedFace
    expect((result!.frames[0].faces[0] as any).keypoints).toBeUndefined();
  });

  it('returns null when subprocess exits non-zero', async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProc({ stdout: '', exitCode: 1 }) as any);
    const result = await service.detect('/tmp/video.mp4');
    expect(result).toBeNull();
  });

  it('returns null when output JSON has success=false', async () => {
    const payload = JSON.stringify({ success: false, error: 'missing model' });
    mockSpawn.mockReturnValueOnce(makeFakeProc({ stdout: payload }) as any);
    const result = await service.detect('/tmp/video.mp4');
    expect(result).toBeNull();
  });

  it('returns null when subprocess emits a spawn error', async () => {
    mockSpawn.mockReturnValueOnce(
      makeFakeProc({ spawnError: new Error('ENOENT') }) as any,
    );
    const result = await service.detect('/tmp/video.mp4');
    expect(result).toBeNull();
  });

  it('caches results and shares pending promises for concurrent calls', async () => {
    mockSpawn.mockImplementation(() => makeFakeProc({ stdout: SUCCESS_PAYLOAD, delayMs: 50 }) as any);
    const r1 = service.detect('/tmp/video.mp4');
    const r2 = service.detect('/tmp/video.mp4');

    expect(r1).toBe(r2);
    const [res1, res2] = await Promise.all([r1, r2]);
    expect(res1).toBe(res2);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('evicts least recently used entry when max cache size is reached', async () => {
    const smallCacheService = new FaceDetectionService(
      makeConfig({ FACE_DETECTION_MAX_CACHE_ENTRIES: '2' }),
    );
    mockSpawn.mockImplementation(() => makeFakeProc({ stdout: SUCCESS_PAYLOAD }) as any);

    await smallCacheService.detect('/tmp/v1.mp4');
    await smallCacheService.detect('/tmp/v2.mp4');
    // Access v1 again to make v2 the oldest (LRU)
    await smallCacheService.detect('/tmp/v1.mp4');
    expect(mockSpawn).toHaveBeenCalledTimes(2);

    // Adding v3 should evict v2 (since v1 was refreshed)
    await smallCacheService.detect('/tmp/v3.mp4');
    expect(mockSpawn).toHaveBeenCalledTimes(3);

    // v1 is still cached
    await smallCacheService.detect('/tmp/v1.mp4');
    expect(mockSpawn).toHaveBeenCalledTimes(3);

    // v2 was evicted, so accessing it spawns a new process
    await smallCacheService.detect('/tmp/v2.mp4');
    expect(mockSpawn).toHaveBeenCalledTimes(4);
  });

  it('explicit invalidation clears the cache for a path', async () => {
    mockSpawn.mockImplementation(() => makeFakeProc({ stdout: SUCCESS_PAYLOAD }) as any);
    await service.detect('/tmp/video.mp4');
    service.invalidate('/tmp/video.mp4');
    await service.detect('/tmp/video.mp4');
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });

  it('handles cancellation abort signal correctly', async () => {
    const controller = new AbortController();
    const fakeProc = makeFakeProc({ stdout: SUCCESS_PAYLOAD, delayMs: 200 });
    mockSpawn.mockReturnValueOnce(fakeProc as any);

    await mediaExecution.run(
      { signal: controller.signal, children: new Set() },
      async () => {
        const detectPromise = service.detect('/tmp/video.mp4');
        // Trigger abort mid-flight
        setImmediate(() => controller.abort());
        const result = await detectPromise;
        expect(result).toBeNull();
      },
    );
  });

  it('respects duration-aware timeout calculation', async () => {
    // Config with very short timeout
    const timeoutService = new FaceDetectionService(
      makeConfig({ FACE_DETECTION_TIMEOUT_MS: '50' }),
    );
    // Subprocess takes 200ms to respond
    const fakeProc = makeFakeProc({ stdout: SUCCESS_PAYLOAD, delayMs: 200 });
    mockSpawn.mockReturnValueOnce(fakeProc as any);

    const result = await timeoutService.detect('/tmp/video.mp4', 60);
    expect(result).toBeNull();
  });
});

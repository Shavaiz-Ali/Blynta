/* Mock database/storage boundaries intentionally use partial objects. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { EditRenderService } from '../ai-editor/edit-render.service';
import { examplePlan } from '../ai-editor/edit-plan.fixture';
import { compileTimeline } from '../ai-editor/timeline';
import { canvasSize } from '../studio/studio.renderer';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';

jest.mock('../media/utils/run-command-with-progress');
describe('editing Batch boundary', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'blynta-edit-batch-test-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    jest.clearAllMocks();
  });
  it.each([false, true])(
    'keeps validation and post-render verification with aws_batch=%s',
    async (enabled) => {
      const plan = examplePlan();
      const timeline = compileTimeline(plan, 10);
      const size = canvasSize(
        '16:9',
        plan.video.resolution === '1080p' ? 1080 : 720,
      );
      const metadata = {
        durationSeconds: 10,
        width: 160,
        height: 90,
        hasVideo: true,
        hasAudio: true,
      };
      const inspection = {
        inspect: jest.fn(async (path: string) =>
          path.endsWith('output.mp4')
            ? {
                ...metadata,
                ...size,
                durationSeconds: timeline.duration,
                fps: plan.video.fps,
              }
            : metadata,
        ),
      };
      const r2 = {
        objectInfo: jest.fn(async () => ({ size: 6, etag: 'etag' })),
        downloadToLocal: jest.fn(async (_key, path) => {
          await writeFile(path, 'output');
        }),
        uploadFile: jest.fn(async () => {}),
      };
      const validator = {
        validate: jest.fn(async () => ({ plan, timeline, media: new Map() })),
      };
      const batch = {
        enabled,
        execute: jest.fn(async (_id, prepare, progress) => {
          const manifest = await prepare(
            'job-sources/batch/test',
            Date.now() + 60000,
          );
          expect(manifest.kind).toBe('edit');
          expect(manifest.args.at(-1)).toBe('output.mp4');
          expect(manifest.args.some((a) => isAbsolute(a))).toBe(false);
          expect(manifest.files.map((f) => f.name)).toEqual(
            expect.arrayContaining(['source.mp4', 'filters.txt']),
          );
          expect(
            await readFile(join(directory, 'filters.txt'), 'utf8'),
          ).toContain('[video]');
          await progress('encoding', 70);
          return { outputKey: 'job-sources/batch/test/output.mp4', bytes: 6 };
        }),
      };
      jest
        .mocked(runCommandWithProgress)
        .mockImplementation(
          async (_command, args, _tick, _registry, options) => {
            if (options?.cwd)
              await writeFile(join(options.cwd, 'output.mp4'), 'output');
          },
        );
      const service = new EditRenderService(
        r2 as any,
        inspection as any,
        {} as any,
        validator as any,
        new ConfigService(),
        batch as any,
      );
      const onProgress = jest.fn();
      const onPhase = jest.fn(async () => {});
      const result = await service.render(
        {
          userId: 'user',
          planId: 'plan',
          revision: 1,
          profile: 'preview',
          plan,
          sourceMedia: { storageKey: 'clips/source.mp4', duration: 10 },
        } as any,
        directory,
        onProgress,
        onPhase,
      );
      expect(result.bytes).toBe(6);
      expect(validator.validate).toHaveBeenCalledTimes(1);
      expect(inspection.inspect).toHaveBeenCalledWith(
        join(directory, 'output.mp4'),
        true,
      );
      // Full decode still happens locally after the remote or local encoder.
      expect(runCommandWithProgress).toHaveBeenLastCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-xerror', '-f', 'null']),
        expect.any(Function),
        expect.anything(),
      );
      if (enabled) {
        expect(batch.execute).toHaveBeenCalledTimes(1);
        expect(onProgress).toHaveBeenCalledWith(70);
        expect(r2.uploadFile).toHaveBeenCalledTimes(2);
      } else {
        expect(batch.execute).not.toHaveBeenCalled();
        expect(r2.uploadFile).not.toHaveBeenCalled();
      }
    },
  );
});

import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProcessRegistryService } from '../common/services/process-registry.service';
import { ClipCuttingService } from '../media/services/clip-cutting.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { MediaInspectionService } from '../media/services/media-inspection.service';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';
import { encodingProgress } from '../ai-editor/encoding-progress';
import {
  assertNotCancelled,
  drainMediaChildren,
  mediaExecution,
} from '../jobs/cancellation-context';
import { R2Service } from '../storage/r2.service';
import { r2FailureDetails } from '../storage/r2-diagnostics';
import {
  assertBatchStorage,
  assertBatchTaskKeys,
  RenderTask,
} from './render-task';

/** Trusted backend manifests only; this is not a public FFmpeg command API. */
export async function runRenderer(
  key: string,
  jobId: string,
  config = new ConfigService(),
  r2 = new R2Service(config),
  registry = new ProcessRegistryService(),
) {
  if (!/^job-sources\/batch\/[a-f0-9]{64}\/task\.json$/.test(key) || !jobId)
    throw new UnrecoverableError('Invalid renderer task identity');
  assertBatchStorage(config);
  const logger = new Logger('BatchRenderer');
  const atStage = async <T>(
    stage: string,
    operation: string,
    work: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      logger.error(
        JSON.stringify({
          event: 'renderer_stage_failed',
          jobId,
          stage,
          operation,
          ...r2FailureDetails(error, [
            config.get<string>('R2_ACCESS_KEY_ID', ''),
            config.get<string>('R2_SECRET_ACCESS_KEY', ''),
          ]),
        }),
      );
      throw error;
    }
  };
  const prefix = key.slice(0, -'/task.json'.length);
  const task = JSON.parse(
    (
      await atStage('manifest_download', 'GetObject', () =>
        r2.downloadToBuffer(key, 2 * 1024 * 1024),
      )
    ).toString(),
  ) as RenderTask;
  assertBatchTaskKeys(task, prefix);
  if (
    task.version !== 1 ||
    task.outputKey !== `${prefix}/output.mp4` ||
    !Number.isFinite(task.deadline) ||
    task.deadline <= Date.now()
  )
    throw new UnrecoverableError('Invalid or expired task');
  const directory = await mkdtemp(join(tmpdir(), 'blynta-batch-'));
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  const deadline = setTimeout(
    stop,
    Math.min(task.deadline - Date.now(), 86400000),
  );
  let writes = Promise.resolve();
  let lastTick = 0;
  const progress = (phase: string, percent: number, force = false) => {
    if (!force && Date.now() - lastTick < 2000) return;
    lastTick = Date.now();
    writes = writes.then(async () => {
      assertNotCancelled();
      await atStage(phase, 'PutProgress', () =>
        r2.uploadBuffer(
          Buffer.from(JSON.stringify({ jobId, phase, percent })),
          `${prefix}/progress.json`,
          'application/json',
        ),
      );
    });
    // Observe immediately; await again before publishing any successful result.
    void writes.catch(stop);
  };
  try {
    await mediaExecution.run(
      { signal: abort.signal, children: new Set() },
      async () => {
        try {
          let output = join(directory, 'output.mp4');
          let duration: number;
          let cuttingSeconds = 0;
          let captioningSeconds = 0;
          if (task.kind === 'clip') {
            try {
              await atStage('source_check', 'HeadObject', () =>
                r2.objectInfo(task.sourceKey),
              );
            } catch (error) {
              const failure = error as {
                name?: string;
                $metadata?: { httpStatusCode?: number };
              };
              if (
                failure.$metadata?.httpStatusCode === 404 ||
                ['NotFound', 'NoSuchKey'].includes(failure.name ?? '')
              )
                throw new UnrecoverableError(
                  'Renderer source object is missing; restore the durable source before retrying',
                );
              throw error;
            }
            duration = task.end - task.start;
            if (
              !Number.isFinite(duration) ||
              duration <= 0 ||
              task.start < 0 ||
              !['job-sources/', 'source-videos/'].some((p) =>
                task.sourceKey.startsWith(p),
              )
            )
              throw new Error('Invalid clip task');
            // Generate at execution time, so time in the Batch queue does not expire it.
            const source = await atStage(
              'source_signing',
              'PresignGetObject',
              () =>
                r2.getSignedDownloadUrl(
                  task.sourceKey,
                  Math.min(
                    86400,
                    Math.ceil((task.deadline - Date.now()) / 1000) + 60,
                  ),
                ),
            );
            progress('cutting', 0, true);
            const raw = join(directory, 'clip.mp4');
            const cutStarted = Date.now();
            await atStage('cutting', 'FFmpegSignedSourceRead', () =>
              new ClipCuttingService(registry).cutClip(
                source,
                task.start,
                task.end,
                raw,
                (p) => progress('cutting', p.progress),
              ),
            );
            cuttingSeconds = (Date.now() - cutStarted) / 1000;
            output = raw;
            if (task.segments.length) {
              progress('captioning', 0, true);
              output = join(directory, 'output.mp4');
              const captionStarted = Date.now();
              await atStage('captioning', 'FFmpeg', () =>
                new CaptionBurningService(registry).burnCaptions(
                  raw,
                  task.segments,
                  output,
                  task.style,
                  duration,
                  (p) => progress('captioning', p.progress),
                ),
              );
              captioningSeconds = (Date.now() - captionStarted) / 1000;
            }
          } else if (task.kind === 'edit') {
            duration = task.duration;
            let total = 0;
            const names = new Set<string>();
            for (const file of task.files) {
              if (
                !/^[\w.-]+$/.test(file.name) ||
                file.name === '.' ||
                file.name === '..' ||
                file.name === 'output.mp4' ||
                names.has(file.name) ||
                !file.key.startsWith(`${prefix}/inputs/`) ||
                !Number.isSafeInteger(file.size) ||
                file.size <= 0
              )
                throw new Error('Invalid staged input');
              names.add(file.name);
              total += file.size;
              if (total > 8 * 1024 ** 3)
                throw new Error('Staged inputs exceed task disk budget');
              await atStage('input_download', 'GetObject', () =>
                r2.downloadToLocal(file.key, join(directory, file.name), {
                  maxBytes: file.size,
                  etag: file.etag,
                }),
              );
            }
            if (
              !task.args.length ||
              task.args.at(-1) !== 'output.mp4' ||
              !Number.isFinite(duration) ||
              duration <= 0
            )
              throw new Error('Invalid editing task');
            // Paths have been made workspace-relative by the backend compiler adapter.
            await atStage('encoding', 'FFmpeg', () =>
              runCommandWithProgress(
                'ffmpeg',
                task.args,
                (line) => {
                  const value = encodingProgress(line, duration);
                  if (value !== undefined) progress('encoding', value);
                },
                registry,
                { cwd: directory },
              ),
            );
          } else throw new Error('Unknown task kind');
          assertNotCancelled();
          const probe = await atStage('media_verification', 'FFprobe', () =>
            new MediaInspectionService(registry).inspect(output, true),
          );
          if (
            !probe.hasVideo ||
            Math.abs(probe.durationSeconds - duration) > 0.25
          )
            throw new Error('Remote render failed media verification');
          progress('uploading', 99, true);
          await writes;
          await atStage('output_upload', 'PutObject', () =>
            r2.uploadFile(output, task.outputKey),
          );
          const bytes = (await stat(output)).size;
          if (
            !bytes ||
            (
              await atStage('output_verification', 'HeadObject', () =>
                r2.objectInfo(task.outputKey),
              )
            ).size !== bytes
          )
            throw new Error('Remote upload verification failed');
          assertNotCancelled();
          // This marker alone never authorizes backend completion: Batch must SUCCEED.
          await atStage('result_upload', 'PutObject', () =>
            r2.uploadBuffer(
              Buffer.from(
                JSON.stringify({
                  jobId,
                  outputKey: task.outputKey,
                  bytes,
                  cuttingSeconds,
                  captioningSeconds,
                }),
              ),
              `${prefix}/result.json`,
              'application/json',
            ),
          );
        } finally {
          await drainMediaChildren();
        }
      },
    );
  } finally {
    clearTimeout(deadline);
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    await writes.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}

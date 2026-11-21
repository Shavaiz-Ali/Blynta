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
  withR2ObjectContext,
  r2ObjectContext,
} from '../storage/r2-object-context';
import { annotateRenderFailure, renderFailure } from './render-failure';
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
  let canPublishFailure = false;
  try {
    return await withR2ObjectContext({ batchJobId: jobId }, () =>
      runRendererTask(key, jobId, config, r2, registry, () => {
        canPublishFailure = true;
      }),
    );
  } catch (error) {
    const detail = renderFailure(error);
    new Logger('BatchRenderer').error({
      event: 'renderer.failed',
      batchJobId: jobId,
      ...detail,
    });
    // A failure marker never authorizes success. Its Batch ID and attempt are checked
    // only after AWS reports FAILED; a prior retry's marker cannot explain a later attempt.
    if (
      canPublishFailure &&
      /^job-sources\/batch\/[a-f0-9]{64}\/task\.json$/.test(key) &&
      jobId
    ) {
      await r2
        .uploadBuffer(
          Buffer.from(
            JSON.stringify({
              jobId,
              attempt: Number(process.env.AWS_BATCH_JOB_ATTEMPT || 1),
              ...detail,
            }),
          ),
          key.replace(/task\.json$/, 'failure.json'),
          'application/json',
        )
        .catch(() =>
          new Logger('BatchRenderer').warn({
            event: 'renderer.failure_marker_unavailable',
            batchJobId: jobId,
          }),
        );
    }
    throw error;
  }
}

async function runRendererTask(
  key: string,
  jobId: string,
  config: ConfigService,
  r2: R2Service,
  registry: ProcessRegistryService,
  validated: () => void,
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
      annotateRenderFailure(error, stage);
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
  const task = await atStage(
    'manifest_download',
    'GetObject',
    async () =>
      JSON.parse(
        (await r2.downloadToBuffer(key, 2 * 1024 * 1024)).toString(),
      ) as RenderTask,
  );
  try {
    assertBatchTaskKeys(task, prefix);
  } catch (error) {
    throw annotateRenderFailure(error, 'manifest_download');
  }
  validated();
  const context = r2ObjectContext.getStore();
  if (context)
    for (const name of ['jobId', 'clipId'] as const) {
      const id = task.owner?.[name];
      if (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id))
        context[name] = id;
    }
  logger.log({
    event: 'renderer.started',
    ...context,
    batchJobId: jobId,
    manifestKey: key,
    outputKey: task.outputKey,
    kind: task.kind,
    captionSegments: task.kind === 'clip' ? task.segments?.length : undefined,
    fontFamily: task.kind === 'clip' ? task.style?.fontFamily : undefined,
  });
  if (
    task.version !== 1 ||
    task.outputKey !== `${prefix}/output.mp4` ||
    !Number.isFinite(task.deadline) ||
    task.deadline <= Date.now()
  )
    throw annotateRenderFailure(
      new UnrecoverableError('Invalid or expired task'),
      task.deadline <= Date.now() ? 'timeout' : 'manifest_download',
    );
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
                withR2ObjectContext(
                  { artifactType: 'source', expectedToExist: true },
                  () => r2.objectInfo(task.sourceKey),
                ),
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
                throw Object.assign(
                  new UnrecoverableError(
                    'Renderer source object is missing; restore the durable source before retrying',
                  ),
                  { renderFailure: renderFailure(error, 'source_check') },
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
            const cropMode =
              typeof task.cropX === 'string'
                ? 'dynamic'
                : typeof task.cropX === 'number'
                  ? 'static'
                  : 'center';

            logger.log({
              event: 'face-detection.crop_received',
              batchJobId: jobId,
              clipId: task.owner?.clipId,
              cropXPresent: task.cropX !== undefined,
              cropMode,
            });

            let finalCropX: number | string | undefined = task.cropX;
            if (finalCropX !== undefined) {
              if (
                typeof finalCropX === 'number' &&
                (!Number.isFinite(finalCropX) || finalCropX < 0)
              ) {
                logger.warn({
                  event: 'face-detection.invalid_crop_coordinates',
                  batchJobId: jobId,
                  clipId: task.owner?.clipId,
                  receivedCropX: finalCropX,
                  reason: 'Negative or non-finite cropX',
                  fallback: 'center',
                });
                finalCropX = undefined;
              } else if (
                typeof finalCropX === 'string' &&
                (!finalCropX.trim() || !/^[0-9a-zA-Z_+\-*/().,\s]+$/.test(finalCropX))
              ) {
                logger.warn({
                  event: 'face-detection.invalid_crop_coordinates',
                  batchJobId: jobId,
                  clipId: task.owner?.clipId,
                  receivedCropX: finalCropX,
                  reason: !finalCropX.trim()
                    ? 'Empty cropX expression'
                    : 'Forbidden characters in cropX expression',
                  fallback: 'center',
                });
                finalCropX = undefined;
              }
            }

            if (finalCropX !== undefined) {
              logger.log({
                event: 'face-detection.crop_applied',
                batchJobId: jobId,
                clipId: task.owner?.clipId,
                cropX: finalCropX,
                selectedCropMode: cropMode,
                cropFilter: `crop=ih*9/16:ih:${finalCropX}:0`,
                outputDimensions: '1080x1920',
              });
            } else {
              logger.log({
                event: 'face-detection.center_crop_used',
                batchJobId: jobId,
                clipId: task.owner?.clipId,
                reason: task.cropX === undefined ? 'no_crop_in_task' : 'invalid_crop_coordinates',
              });
            }

            progress('cutting', 0, true);
            const raw = join(directory, 'clip.mp4');
            const cutStarted = Date.now();
            await atStage('cutting', 'FFmpegSignedSourceRead', () => {
              const cuttingService = new ClipCuttingService(registry);
              return finalCropX !== undefined
                ? cuttingService.cutClip(
                    source,
                    task.start,
                    task.end,
                    raw,
                    (p) => progress('cutting', p.progress),
                    finalCropX,
                  )
                : cuttingService.cutClip(
                    source,
                    task.start,
                    task.end,
                    raw,
                    (p) => progress('cutting', p.progress),
                  );
            });
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
            throw annotateRenderFailure(
              new Error('Remote render failed media verification'),
              'media_verification',
            );
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
                withR2ObjectContext(
                  { artifactType: 'batch_output', expectedToExist: true },
                  () => r2.objectInfo(task.outputKey),
                ),
              )
            ).size !== bytes
          )
            throw annotateRenderFailure(
              new Error('Remote upload verification failed'),
              'output_verification',
            );
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
                  durationSeconds: probe.durationSeconds,
                  hasVideo: probe.hasVideo,
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

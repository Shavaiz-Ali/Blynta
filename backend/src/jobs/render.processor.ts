import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob } from 'bullmq';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { JobsService } from './jobs.service';
import { JobsCompletionService } from './jobs-completion.service';
import { RENDER_QUEUE, RENDER_CLIP, workerConcurrency } from './jobs.constants';
import { JobStatus, ClipProcessingState } from './schemas/job.schema';
import { ClipCuttingService } from '../media/services/clip-cutting.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { R2Service } from '../storage/r2.service';
import {
  resolveStylePreset,
  DEFAULT_STYLE_PRESET_KEY,
} from '../media/style-presets';
import { resolveEditorStyle } from '../media/editor-styles';
import { FfmpegProgress } from '../media/utils/ffmpeg-progress';
import { ClipRenderProgress, clipProgressSample } from './render-progress';
import { RenderSourceService } from './render-source.service';
import { RenderCapacityService } from './render-capacity.service';

interface RenderData {
  jobId: string;
  clipId: string;
}

@Processor(RENDER_QUEUE, {
  concurrency: 1,
  autorun: false,
  lockDuration: 60000,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class RenderProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private logger = new Logger(RenderProcessor.name);
  constructor(
    private jobs: JobsService,
    private completion: JobsCompletionService,
    private config: ConfigService,
    private cutting: ClipCuttingService,
    private captions: CaptionBurningService,
    private r2: R2Service,
    private sources: RenderSourceService,
    private capacity: RenderCapacityService,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    this.worker.concurrency = workerConcurrency(
      this.config.get('RENDER_CONCURRENCY'),
      'RENDER_CONCURRENCY',
    );
    // Configure Redis before any job can be acquired; failure prevents startup.
    await this.capacity.setGlobalConcurrency(
      workerConcurrency(
        this.config.get('RENDER_GLOBAL_CONCURRENCY'),
        'RENDER_GLOBAL_CONCURRENCY',
      ),
    );
    this.worker.on('error', (error) => this.logger.error(error));
    void this.worker.run().catch((error) => this.logger.error(error));
    void this.capacity.startWorker(this.worker);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: BullJob<RenderData> | undefined, error: Error) {
    try {
      if (!job || (await job.getState()) !== 'failed') return;
      const current = await this.jobs.findJob(job.data.jobId);
      const clip = current?.clips.find(
        (c) => c._id.toString() === job.data.clipId,
      );
      // Never replace a durable success when completion publication alone failed.
      if (
        clip &&
        !clip.retryRequested &&
        clip.status !== JobStatus.COMPLETED &&
        (await job.getState()) === 'failed'
      )
        await this.jobs.failUnfinishedClip(
          job.data.jobId,
          job.data.clipId,
          error.message,
          clip.errorStage ?? 'worker',
          clip.retryCount,
        );
      await this.completion.finalize(job.data.jobId);
    } catch (failure) {
      this.logger.error(`Failure handling will be reconciled: ${failure}`);
    }
  }

  async process(bullJob: BullJob<RenderData>) {
    if (bullJob.name !== RENDER_CLIP)
      throw new Error(`Unknown render job: ${bullJob.name}`);
    const { jobId, clipId } = bullJob.data;
    const parent = await this.jobs.findJob(jobId);
    const clip = parent?.clips.find((c) => c._id.toString() === clipId);
    if (!parent || !clip) return;
    if (clip.status === JobStatus.COMPLETED && clip.r2ObjectKey) {
      await this.completion.finalize(jobId);
      return;
    }
    const started = Date.now();
    let directory: string | undefined;
    let sourceLease:
      Awaited<ReturnType<RenderSourceService['acquire']>> | undefined;
    let state = ClipProcessingState.QUEUED;
    let ffmpegStarted = 0;
    let ffmpegElapsedMs = 0;
    let cuttingSeconds = 0;
    let captioningSeconds = 0;
    let latest =
      typeof bullJob.progress === 'object'
        ? (bullJob.progress as ClipRenderProgress)
        : undefined;
    if (
      clip.retryQueuedAt &&
      latest &&
      latest.updatedAt < new Date(clip.retryQueuedAt).getTime()
    )
      latest = undefined;
    let lastPublished = 0;
    // Serialize and drain async Redis writes so old stage updates cannot overwrite new ones.
    let publishing: Promise<void> = Promise.resolve();
    const duration = clip.endTime - clip.startTime;
    const segments = parent.transcript
      .filter((s) => s.endTime > clip.startTime && s.startTime < clip.endTime)
      .map((s) => ({
        startTime: Math.max(s.startTime, clip.startTime) - clip.startTime,
        endTime: Math.min(s.endTime, clip.endTime) - clip.startTime,
        text: s.text,
      }));
    const hasCaptions = segments.length > 0;
    const objectKey = `clips/${jobId}/${clipId}-captioned.mp4`;
    const publish = (sample?: FfmpegProgress, force = false) => {
      latest = clipProgressSample(
        {
          clipId,
          status: state,
          durationSeconds: duration,
          cuttingSeconds,
          hasCaptions,
        },
        sample,
        latest,
      );
      if (!force && Date.now() - lastPublished < 750) return;
      lastPublished = Date.now();
      const snapshot = latest;
      publishing = publishing
        .then(() => bullJob.updateProgress(snapshot))
        .catch((error) => {
          this.logger.warn(
            `[jobId=${jobId}][clipId=${clipId}] Progress publish failed: ${error}`,
          );
        });
    };
    const transition = async (next: ClipProcessingState) => {
      state = next;
      await this.jobs.updateClip(jobId, clipId, {
        status:
          next === ClipProcessingState.READY
            ? JobStatus.COMPLETED
            : JobStatus.CUTTING_CLIPS,
        processingState: next,
      });
      publish(undefined, true);
    };
    try {
      await this.jobs.updateClip(jobId, clipId, {
        attemptCount: (clip.attemptCount ?? 0) + 1,
      });
      if (!parent.sourceObjectKey)
        throw new Error('Durable source reference missing');
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error('Invalid clip duration');
      // PUT is atomic: a prior attempt may have uploaded before its Mongo commit.
      if (await this.r2.fileExists(objectKey)) {
        await this.jobs.updateClip(jobId, clipId, {
          status: JobStatus.COMPLETED,
          processingState: ClipProcessingState.READY,
          r2ObjectKey: objectKey,
          outputUrl: objectKey,
          hasCaptions,
          errorMessage: '',
          errorStage: '',
        });
        state = ClipProcessingState.READY;
        publish(undefined, true);
        await publishing;
        await this.completion.finalize(jobId);
        this.logger.log(
          JSON.stringify({
            event: 'render_recovered',
            jobId,
            clipId,
            retryCount: bullJob.attemptsMade,
          }),
        );
        return;
      }
      const root = join(
        this.config.get<string>('STORAGE_ROOT', '/var/blynta/storage'),
        'renders',
      );
      await mkdir(root, { recursive: true });
      directory = await mkdtemp(join(root, `${jobId}-${clipId}-`));
      await transition(ClipProcessingState.QUEUED);
      sourceLease = await this.sources.acquire(jobId, parent.sourceObjectKey);
      await transition(ClipProcessingState.CUTTING);
      const raw = join(directory, 'clip.mp4');
      ffmpegStarted = Date.now();
      await this.cutting.cutClip(
        sourceLease.path,
        clip.startTime,
        clip.endTime,
        raw,
        (sample) => {
          if (state === ClipProcessingState.CUTTING) publish(sample);
        },
      );
      ffmpegElapsedMs += Date.now() - ffmpegStarted;
      cuttingSeconds = (Date.now() - ffmpegStarted) / 1000;
      let final = raw;
      if (hasCaptions) {
        await transition(ClipProcessingState.CAPTIONING);
        const preset = resolveStylePreset(parent.stylePreset);
        const highlight = parent.highlights.find(
          (h) => h.startTime === clip.startTime && h.endTime === clip.endTime,
        );
        const style =
          preset.key !== DEFAULT_STYLE_PRESET_KEY
            ? preset.captionStyle
            : resolveEditorStyle(highlight?.style).captionStyle;
        final = join(directory, 'captioned.mp4');
        ffmpegStarted = Date.now();
        await this.captions.burnCaptions(
          raw,
          segments,
          final,
          style,
          duration,
          (sample) => {
            if (state === ClipProcessingState.CAPTIONING) publish(sample);
          },
        );
      }
      if (hasCaptions) {
        captioningSeconds = (Date.now() - ffmpegStarted) / 1000;
        ffmpegElapsedMs += captioningSeconds * 1000;
      }
      const averageSpeed =
        (duration * (hasCaptions ? 2 : 1)) /
        Math.max(0.001, ffmpegElapsedMs / 1000);
      await transition(ClipProcessingState.UPLOADING);
      await this.r2.uploadFile(final, objectKey);
      const totalSeconds = (Date.now() - started) / 1000;
      await this.jobs.updateClip(jobId, clipId, {
        renderTiming: {
          cuttingSeconds,
          captioningSeconds,
          overheadSeconds: Math.max(
            0,
            totalSeconds - cuttingSeconds - captioningSeconds,
          ),
          totalSeconds,
        },
        status: JobStatus.COMPLETED,
        processingState: ClipProcessingState.READY,
        r2ObjectKey: objectKey,
        outputUrl: objectKey,
        hasCaptions,
        errorMessage: '',
        errorStage: '',
      });
      state = ClipProcessingState.READY;
      publish(undefined, true);
      await publishing;
      await this.completion.finalize(jobId);
      this.logger.log(
        JSON.stringify({
          event: 'render_completed',
          jobId,
          clipId,
          userId: parent.userId.toString(),
          queueWaitMs: started - bullJob.timestamp,
          renderMs: Date.now() - started,
          durationSeconds: duration,
          metadata: parent.mediaMetadata,
          workload: parent.workload,
          ffmpegAverageSpeed: averageSpeed,
          retryCount: bullJob.attemptsMade,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureStage =
        state === ClipProcessingState.QUEUED ? 'source_download' : state;
      const current = await this.jobs.findJob(jobId);
      const durable = current?.clips.find((c) => c._id.toString() === clipId);
      if (durable?.status !== JobStatus.COMPLETED)
        await this.jobs.updateClip(jobId, clipId, {
          status: JobStatus.PENDING,
          processingState: ClipProcessingState.QUEUED,
          errorMessage: message,
          errorStage: failureStage,
        });
      this.logger.error(
        JSON.stringify({
          event: 'render_failed',
          jobId,
          clipId,
          stage: failureStage,
          message,
          retryCount: bullJob.attemptsMade,
        }),
      );
      throw error;
    } finally {
      await publishing;
      const finalParent = await this.jobs.findJob(jobId).catch(() => null);
      await sourceLease
        ?.release(
          !finalParent ||
            [JobStatus.COMPLETED, JobStatus.FAILED].includes(
              finalParent.status,
            ),
        )
        .catch((error) =>
          this.logger.warn(
            `[jobId=${jobId}][clipId=${clipId}] Source cleanup failed: ${error}`,
          ),
        );
      if (directory)
        await rm(directory, { recursive: true, force: true }).catch((error) =>
          this.logger.warn(
            `[jobId=${jobId}][clipId=${clipId}] Cleanup failed: ${error}`,
          ),
        );
    }
  }
}

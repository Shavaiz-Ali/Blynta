import { assertNotCancelled, drainMediaChildren } from './cancellation-context';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob } from 'bullmq';
import {
  MediaInspectionService,
  estimateVideoWorkload,
} from '../media/services/media-inspection.service';
import { JobsCompletionService } from './jobs-completion.service';
import { workerConcurrency } from './jobs.constants';
import * as fs from 'fs';
import * as path from 'path';
import {
  JOBS_QUEUE,
  JOBS_TYPES,
  ALLOWED_PAID_AI_MODELS,
} from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobStatus, TranscriptSegment } from './schemas/job.schema';
import { SourceVideoDocument } from './schemas/source-video.schema';
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import { VideoDownloadService } from '../media/services/video-download.service';
import {
  TranscriptionService,
  TranscriptSegmentDto,
} from '../media/services/transcription.service';
import {
  HighlightDetectionService,
  HighlightDto,
} from '../media/services/highlight-detection.service';
import { SourceVideoService } from '../media/services/source-video.service';
import { R2Service } from '../storage/r2.service';
import {
  resolveStylePreset,
  DEFAULT_STYLE_PRESET_KEY,
} from '../media/style-presets';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Processor(JOBS_QUEUE, {
  concurrency: 1,
  autorun: false,
  lockDuration: 60_000, // ms a job can be "locked" by a worker before considered stalled
  stalledInterval: 30_000, // how often BullMQ checks for stalled jobs
  maxStalledCount: 1, // after this many stall-detections, job is marked FAILED
})
export class JobsProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
    private configService: ConfigService,
    private videoDownloadService: VideoDownloadService,
    private transcriptionService: TranscriptionService,
    private highlightDetectionService: HighlightDetectionService,
    private sourceVideoService: SourceVideoService,
    private r2Service: R2Service,
    private inspection: MediaInspectionService,
    private completion: JobsCompletionService,
    private activitiesService: ActivitiesService,
  ) {
    super();
  }

  onApplicationBootstrap() {
    this.worker.concurrency = workerConcurrency(
      this.configService.get('PIPELINE_CONCURRENCY'),
      'PIPELINE_CONCURRENCY',
    );
    this.worker.on('error', (error) => this.logger.error(error));
    void this.worker.run().catch((error) => this.logger.error(error));
  }

  @OnWorkerEvent('failed')
  async onFailed(
    bullJob: BullJob<{ jobId: string }> | undefined,
    error: Error,
  ) {
    try {
      if (bullJob && (await bullJob.getState()) === 'failed') {
        const parent = await this.jobsService.findJob(bullJob.data.jobId);
        if (parent?.cancellationRequestedAt) return;
        if (!parent?.renderManifestReady) assertNotCancelled();
        await this.jobsService.updateJob(bullJob.data.jobId, {
          status: JobStatus.FAILED,
          errorMessage: error.message,
        });
        await this.completion.publish(bullJob.data.jobId);
      }
    } catch (failure) {
      this.logger.error(`Failure handling will be reconciled: ${failure}`);
    }
  }

  @OnWorkerEvent('completed')
  async onCompleted(bullJob: BullJob<{ jobId: string }>) {
    await this.jobsService
      .finalizeCancellation(bullJob.data.jobId)
      .catch((error) =>
        this.logger.warn(`Cancellation will be reconciled: ${error}`),
      );
  }

  async process(bullJob: BullJob<{ jobId: string }>): Promise<void> {
    switch (bullJob.name) {
      case JOBS_TYPES.CLIP_VIDEO: {
        const { jobId } = bullJob.data;
        await this.jobsService.runMediaExecution(jobId, () =>
          this.processClipVideoJob(jobId, bullJob),
        );
        break;
      }
      default:
        throw new Error(`Unknown job type: ${bullJob.name}`);
    }
  }

  private async processClipVideoJob(
    jobId: string,
    bullJob: BullJob<{ jobId: string }>,
  ): Promise<void> {
    const started = Date.now();
    assertNotCancelled();
    const existing = await this.jobsService.findJob(jobId);
    if (!existing) return;
    if (existing.renderManifestReady) {
      assertNotCancelled();
      await this.jobsService.enqueueRenders(jobId);
      await this.completion.finalize(jobId);
      return;
    }
    const job = await this.jobsService.updateJob(jobId, {
      status: JobStatus.PENDING,
      errorMessage: undefined,
      errorStage: undefined,
    });
    if (!job) throw new Error(`Job ${jobId} not found at process start`);

    const userId = job.userId.toString();
    const storageRoot = this.configService.get<string>(
      'STORAGE_ROOT',
      '/var/blynta/storage',
    );
    const jobDir = path.join(storageRoot, 'jobs', jobId);
    const clipsDir = path.join(jobDir, 'clips');

    try {
      await fs.promises.mkdir(clipsDir, { recursive: true });

      // --- User & Plan resolution lookup ---
      const user = await this.usersService.findById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      // Record Activity: Video processing started
      await this.activitiesService.queueCreateIfNotExists({
        userId: job.userId,
        type: ActivityType.JOB_START,
        category: ActivityCategory.JOB,
        title: 'Video processing started',
        description: 'AI model is analyzing highlights and cutting clips.',
        activityUrl: `/dashboard/jobs/${jobId}`,
        entityType: 'job',
        entityId: jobId,
        actorType: ActivityActorType.WORKER,
        isSystem: true,
        status: ActivityStatus.PENDING,
        severity: ActivitySeverity.INFO,
        dedupeKey: `activity:job:${jobId}:start`,
      });

      // const resolution: '720p' | '1080p' =
      //   user.plan === UserPlan.PRO || user.plan === UserPlan.BUSINESS ? '1080p' : '720p';
      const resolution: '720p' | '1080p' | '360p' | '240p' = '240p';

      let lastProgressUpdate = 0;
      const makeThrottledProgressUpdate = () => (percent: number) => {
        this.logger.debug(
          `[${jobId}] Raw progress callback fired: ${percent}%`,
        );
        const now = Date.now();
        if (now - lastProgressUpdate < 2000) return;
        lastProgressUpdate = now;
        void this.jobsService
          .updateJob(jobId, {
            progressPercent: Math.round(percent),
          })
          .catch((error) =>
            this.logger.warn(`Pipeline progress update failed: ${error}`),
          );
      };

      // =========================================================================
      // Resume-state detection — check DB fields AND verify files still exist on
      // disk before trusting them. Trusting DB alone risks ENOENT crashes deep in
      // a later stage if the volume was wiped between failure and retry.
      // =========================================================================
      const hasLocalVideo = Boolean(
        job.localVideoPath && fs.existsSync(job.localVideoPath),
      );
      const hasLocalAudio = Boolean(
        job.localAudioPath && fs.existsSync(job.localAudioPath),
      );
      const hasTranscript = Boolean(
        job.transcript && job.transcript.length > 0,
      );
      const hasHighlights = Boolean(
        job.highlights && job.highlights.length > 0,
      );

      this.logger.log(
        `[${jobId}] Resume check — video:${hasLocalVideo} audio:${hasLocalAudio} transcript:${hasTranscript} highlights:${hasHighlights}`,
      );

      // =========================================================================
      // Stage 1: Download (or resume) + Stage 2: Transcribe (or resume)
      //
      // Retry resume takes priority: if local files + transcript are already on
      // disk from a prior attempt, skip download and/or transcription entirely.
      // Falls through to the SourceVideo cache-hit path, then fresh download,
      // only when the resume check can't find valid local state.
      //
      // For YouTube jobs (non-resume path), check SourceVideo cache first. On a
      // hit, pull the already-processed video and audio from R2 into the job's
      // local temp dir and skip download + transcription entirely. On a miss (or
      // for non-YouTube platforms where extractExternalId returns null), process
      // fresh and then upload to R2 + create a SourceVideo entry.
      // =========================================================================

      const externalId = this.sourceVideoService.extractExternalId(
        job.sourcePlatform,
        job.sourceUrl,
      );
      let sourceVideo: SourceVideoDocument | null = null;

      let videoPath = '';
      let audioPath = '';
      let transcript: TranscriptSegmentDto[] = [];

      // Commit normalized metadata and a durable source before expensive AI work.
      const prepareSource = async (
        input: string,
        cached?: SourceVideoDocument,
      ) => {
        const latest = await this.jobsService.findJob(jobId);
        const metadata =
          latest?.mediaMetadata ??
          cached?.mediaMetadata ??
          (await this.inspection.inspect(input));
        if (!metadata.hasVideo || metadata.durationSeconds <= 0)
          throw new Error('Invalid source video metadata');
        await this.jobsService.assertSourceBudget(
          jobId,
          metadata.durationSeconds,
        );
        const key =
          latest?.sourceObjectKey ??
          cached?.videoObjectKey ??
          (externalId
            ? `source-videos/${externalId}/video.mp4`
            : `job-sources/${jobId}/video.mp4`);
        if (
          !latest?.sourceObjectKey &&
          !cached &&
          !(await this.r2Service.fileExists(key))
        )
          await this.r2Service.uploadFile(input, key);
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          sourceObjectKey: key,
          mediaMetadata: metadata,
          videoDuration: metadata.durationSeconds,
          workload: estimateVideoWorkload(metadata),
        });
        return metadata;
      };

      if (hasTranscript && (hasLocalVideo || job.sourceObjectKey)) {
        // -----------------------------------------------------------------------
        // RESUME (full) — both download AND transcription already completed on
        // a prior attempt and local files are still on disk. Most valuable skip:
        // transcription is the slowest/most resource-heavy local stage.
        // -----------------------------------------------------------------------
        this.logger.log(
          `[${jobId}] Resuming: skipping download + transcription (already complete on disk)`,
        );
        videoPath = hasLocalVideo
          ? job.localVideoPath
          : path.join(jobDir, 'source.mp4');
        if (!hasLocalVideo)
          await this.r2Service.downloadToLocal(job.sourceObjectKey!, videoPath);
        audioPath = job.localAudioPath ?? '';
        transcript = job.transcript;
        await prepareSource(videoPath);
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, { progressPercent: 100 });
      } else if (hasLocalVideo && hasLocalAudio) {
        // -----------------------------------------------------------------------
        // RESUME (partial) — download succeeded, transcription didn't (or its DB
        // output is missing). Skip download only; re-run transcription.
        // -----------------------------------------------------------------------
        this.logger.log(
          `[${jobId}] Resuming: skipping download, re-running transcription`,
        );
        videoPath = job.localVideoPath!;
        audioPath = job.localAudioPath;
        await prepareSource(videoPath);

        this.logger.log(`[${jobId}] Stage 2/5: Transcribing audio (resumed)`);
        lastProgressUpdate = 0;
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          status: JobStatus.TRANSCRIBING,
          progressPercent: 0,
        });

        transcript = await this.transcriptionService.transcribe(
          audioPath,
          makeThrottledProgressUpdate(),
        );
        const transcriptDocsResumed: TranscriptSegment[] = transcript.map(
          (t) => ({
            startTime: t.startTime,
            endTime: t.endTime,
            text: t.text,
          }),
        );
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          transcript: transcriptDocsResumed,
          progressPercent: 100,
        });
      } else {
        // -----------------------------------------------------------------------
        // NO LOCAL RESUME STATE — fall through to the SourceVideo cache-hit path
        // (for YouTube) or a fresh download. This is the existing logic, fully
        // unchanged. Genuinely new jobs and retries where the disk was wiped both
        // land here.
        // -----------------------------------------------------------------------
        if (externalId) {
          sourceVideo = await this.sourceVideoService.findCached(
            job.sourcePlatform,
            externalId,
          );
        }

        if (sourceVideo) {
          try {
            // -------------------------------------------------------------------
            // CACHE HIT — pull from R2 into this job's local temp dir.
            // Stages 1 + 2 are skipped; progress jumps straight to 100 for both.
            // -------------------------------------------------------------------
            this.logger.log(
              `[${jobId}] Cache hit for ${job.sourcePlatform}:${externalId} — reusing video, audio, transcript from SourceVideo ${sourceVideo._id.toString()}`,
            );
            await this.sourceVideoService.recordReuse(
              sourceVideo._id.toString(),
            );

            videoPath = path.join(jobDir, 'source.mp4');
            audioPath = path.join(jobDir, 'audio.wav');

            this.logger.log(`[${jobId}] Downloading cached files from R2...`);
            await this.r2Service.downloadToLocal(
              sourceVideo.videoObjectKey,
              videoPath,
            );
            await this.r2Service.downloadToLocal(
              sourceVideo.audioObjectKey,
              audioPath,
            );

            transcript = sourceVideo.transcript;
            await prepareSource(videoPath, sourceVideo);

            assertNotCancelled();
            await this.jobsService.updateJob(jobId, {
              sourceVideoId: sourceVideo._id,
              localVideoPath: videoPath,
              localAudioPath: audioPath,
              videoTitle: sourceVideo.videoTitle,
              videoUploader: sourceVideo.videoUploader,
              thumbnailUrl: sourceVideo.thumbnailUrl,
              videoDuration: sourceVideo.videoDuration,
              transcript: transcript,
              resolutionUsed: resolution,
              progressPercent: 100,
            });
          } catch (cacheErr) {
            assertNotCancelled();
            this.logger.warn(
              `[${jobId}] Failed to download cached files from R2 for SourceVideo ${sourceVideo._id.toString()} (${cacheErr instanceof Error ? cacheErr.message : cacheErr}); falling back to fresh processing.`,
            );
            sourceVideo = null;
          }
        }

        if (!sourceVideo) {
          // -------------------------------------------------------------------
          // CACHE MISS — process fresh, then upload to R2.
          // Non-YouTube platforms (externalId === null) always land here.
          // -------------------------------------------------------------------
          this.logger.log(
            `[${jobId}] No cache for ${job.sourcePlatform}:${externalId ?? 'n/a'} — downloading fresh`,
          );

          // --- Stage 1: Download ---
          this.logger.log(
            `[${jobId}] Stage 1/5: Downloading video (${resolution})`,
          );
          assertNotCancelled();
          await this.jobsService.updateJob(jobId, {
            status: JobStatus.PENDING,
            progressPercent: 0,
            resolutionUsed: resolution,
          });

          const {
            videoPath: dlVideoPath,
            audioPath: dlAudioPath,
            title,
            uploader,
            thumbnailUrl,
            duration,
          } = await this.videoDownloadService.downloadVideo(
            job.sourceUrl,
            jobDir,
            resolution,
            makeThrottledProgressUpdate(),
            job.creditSourceSeconds,
          );
          videoPath = dlVideoPath;
          audioPath = dlAudioPath;
          await prepareSource(videoPath);

          assertNotCancelled();
          await this.jobsService.updateJob(jobId, {
            localVideoPath: videoPath,
            localAudioPath: audioPath,
            videoTitle: title,
            videoUploader: uploader,
            thumbnailUrl,
            videoDuration: duration,
            progressPercent: 100,
          });

          // --- Stage 2: Transcribe ---
          this.logger.log(`[${jobId}] Stage 2/5: Transcribing audio`);
          lastProgressUpdate = 0;
          assertNotCancelled();
          await this.jobsService.updateJob(jobId, {
            status: JobStatus.TRANSCRIBING,
            progressPercent: 0,
          });

          transcript = hasTranscript
            ? job.transcript
            : await this.transcriptionService.transcribe(
                audioPath,
                makeThrottledProgressUpdate(),
              );
          const transcriptDocs: TranscriptSegment[] = transcript.map((t) => ({
            startTime: t.startTime,
            endTime: t.endTime,
            text: t.text,
          }));
          assertNotCancelled();
          await this.jobsService.updateJob(jobId, {
            transcript: transcriptDocs,
            progressPercent: 100,
          });

          // ONLY cache if this platform actually supports it (YouTube — externalId is non-null)
          if (externalId) {
            this.logger.log(
              `[${jobId}] Uploading source video + audio to R2 for caching`,
            );
            const videoObjectKey = `source-videos/${externalId}/video.mp4`;
            const audioObjectKey = `source-videos/${externalId}/audio.wav`;

            await this.r2Service.uploadFile(audioPath, audioObjectKey);

            const newSourceVideo =
              await this.sourceVideoService.createFromProcessing({
                platform: job.sourcePlatform,
                externalId,
                sourceUrl: job.sourceUrl,
                videoObjectKey,
                audioObjectKey,
                transcript,
                videoTitle: title,
                videoUploader: uploader,
                thumbnailUrl,
                videoDuration: duration,
              });
            assertNotCancelled();
            await this.jobsService.updateJob(jobId, {
              sourceVideoId: newSourceVideo._id,
            });
            sourceVideo = newSourceVideo;
            this.logger.log(
              `[${jobId}] SourceVideo created: ${newSourceVideo._id.toString()} (key: ${videoObjectKey})`,
            );
          }
        }
      }

      const metadata = await prepareSource(videoPath, sourceVideo ?? undefined);
      if (sourceVideo && !sourceVideo.mediaMetadata)
        await this.sourceVideoService.saveMediaMetadata(
          sourceVideo._id.toString(),
          metadata,
        );

      // =========================================================================
      // Stage 3: Highlight detection
      //
      // Resume check: if the job already has highlights persisted from a prior
      // attempt, skip the LLM call entirely — this is the most expensive stage
      // to repeat (costs an API call every time). Mirrors the SourceVideo
      // defaultHighlights cache-hit pattern for consistency.
      //
      // If highlights are missing (fresh job or failed before this stage),
      // fall through to the normal detection + SourceVideo caching logic.
      // =========================================================================
      this.logger.log(`[${jobId}] Stage 3/5: Detecting highlights`);

      const isPaidPlan =
        user.plan === UserPlan.PRO || user.plan === UserPlan.BUSINESS;
      const requestedPreset = resolveStylePreset(job.stylePreset);
      let effectivePresetKey = requestedPreset.key;

      if (requestedPreset.isPro && !isPaidPlan) {
        this.logger.warn(
          `[${jobId}] User requested stylePreset="${requestedPreset.key}" which is Pro-only; falling back to default highlight prompt (caption style is kept).`,
        );
        effectivePresetKey = DEFAULT_STYLE_PRESET_KEY;
      }
      const effectiveHighlightPreset = resolveStylePreset(effectivePresetKey);

      const options: {
        customPrompt?: string;
        model?: string;
        videoDuration: number;
        maxHighlights: number;
      } = {
        videoDuration: job.videoDuration || 0,
        maxHighlights: job.clipTargetMax || (isPaidPlan ? 9 : 6),
      };
      if (effectiveHighlightPreset.highlightPrompt) {
        options.customPrompt = effectiveHighlightPreset.highlightPrompt;
      }
      if (isPaidPlan && job.customPrompt) {
        // explicit freeform prompt still wins/appends over the preset for paid users
        options.customPrompt = job.customPrompt;
      }
      if (isPaidPlan && job.aiModel && job.aiModel !== 'default') {
        if (ALLOWED_PAID_AI_MODELS.includes(job.aiModel)) {
          options.model = job.aiModel;
        } else {
          this.logger.warn(
            `[${jobId}] User requested aiModel="${job.aiModel}" which is not on the allowlist; using default.`,
          );
        }
      }

      // usingCustomOptions must now also account for a Pro style preset, not just customPrompt/aiModel:
      const usingCustomOptions =
        isPaidPlan &&
        (job.customPrompt ||
          (job.aiModel && job.aiModel !== 'default') ||
          requestedPreset.isPro);

      let highlights: HighlightDto[] = [];

      if (hasHighlights) {
        // -----------------------------------------------------------------------
        // RESUME — highlights already detected and persisted on a prior attempt.
        // Skip the LLM call; re-use what's already in the DB.
        // -----------------------------------------------------------------------
        this.logger.log(
          `[${jobId}] Resuming: skipping highlight detection (already have ${job.highlights.length} highlight(s))`,
        );
        highlights = job.highlights;
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          status: JobStatus.DETECTING_HIGHLIGHTS,
        });
      } else {
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          status: JobStatus.DETECTING_HIGHLIGHTS,
        });

        const presetMap = sourceVideo?.defaultHighlightsByPreset;
        const highlightCacheKey = `${effectivePresetKey}:v2:${options.maxHighlights}`;
        const cachedHighlights = presetMap?.get(highlightCacheKey);
        let detectionResult: {
          videoTitle?: string;
          videoDescription?: string;
          keywords?: string;
          hashtags?: string[];
          highlights: HighlightDto[];
        } | null = null;

        if (
          sourceVideo &&
          !usingCustomOptions &&
          cachedHighlights &&
          (cachedHighlights.length >= 6 || (job.videoDuration || 0) < 600)
        ) {
          this.logger.log(
            `[${jobId}] Reusing cached highlights for preset "${effectivePresetKey}" from SourceVideo ${sourceVideo._id.toString()}`,
          );
          highlights = cachedHighlights;
        } else {
          detectionResult =
            await this.highlightDetectionService.detectHighlightsWithMetadata(
              transcript,
              options,
            );
          highlights = detectionResult.highlights;

          // Save default highlights on the SourceVideo so future jobs with this video skip the LLM call
          if (
            !usingCustomOptions &&
            sourceVideo &&
            (highlights.length >= 6 || (job.videoDuration || 0) < 600)
          ) {
            await this.sourceVideoService.saveDefaultHighlights(
              sourceVideo._id.toString(),
              highlightCacheKey,
              highlights,
            );
            this.logger.log(
              `[${jobId}] Saved highlights for preset "${effectivePresetKey}" to SourceVideo ${sourceVideo._id.toString()}`,
            );
          }
        }

        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          ...(detectionResult?.videoDescription
            ? { videoDescription: detectionResult.videoDescription }
            : {}),
          ...(detectionResult?.keywords
            ? { keywords: detectionResult.keywords }
            : {}),
          ...(detectionResult?.hashtags && detectionResult.hashtags.length > 0
            ? { hashtags: detectionResult.hashtags }
            : {}),
          highlights: highlights.map((h) => ({
            startTime: h.startTime,
            endTime: h.endTime,
            reason: h.reason,
            score: h.score,
            clipTitle: h.clipTitle,
            clipDescription: h.clipDescription,
            tags: h.tags || [],
            style: h.style,
            hookText: h.hookText || '',
            emojis: h.emojis || [],
          })),
        });
      }

      assertNotCancelled();
      await this.jobsService.prepareRenderManifest(jobId, highlights);
      assertNotCancelled();
      await this.jobsService.enqueueRenders(jobId);
      await this.completion.finalize(jobId);
      const persisted = await this.jobsService.findJob(jobId);
      this.logger.log(
        JSON.stringify({
          event: 'pipeline_fanout',
          jobId,
          userId,
          queueWaitMs: started - bullJob.timestamp,
          processingMs: Date.now() - started,
          retryCount: bullJob.attemptsMade,
          metadata,
          workload: estimateVideoWorkload(metadata),
          acceptedHighlights: highlights.length,
          persistedClips: persisted?.clips.length || 0,
        }),
      );
    } catch (err) {
      assertNotCancelled();
      const latest = await this.jobsService.findJob(jobId);
      const message = err instanceof Error ? err.message : String(err);
      assertNotCancelled();
      await this.jobsService.updateJob(jobId, {
        status: latest?.renderManifestReady ? latest.status : JobStatus.PENDING,
        errorMessage: message,
        errorStage: latest?.status ?? 'pipeline',
      });
      this.logger.error(
        JSON.stringify({
          event: 'pipeline_failed',
          jobId,
          retryCount: bullJob.attemptsMade,
          stage: latest?.status,
          message,
        }),
      );
      throw err;
    } finally {
      await drainMediaChildren();
      const latest = await this.jobsService.findJob(jobId);
      if (latest?.renderManifestReady || latest?.cancellationRequestedAt) {
        // Render workers use their own R2-backed workspace, never this directory.
        await fs.promises
          .rm(jobDir, { recursive: true, force: true })
          .catch((error) =>
            this.logger.warn(
              `[jobId=${jobId}] Pipeline cleanup failed: ${error}`,
            ),
          );
      }
    }
  }
}

import { createHash } from 'node:crypto';
import { PipelineCacheService } from '../media/services/pipeline-cache.service';
import {
  artifactHash,
  highlightIdentity,
  normalizeInstructions,
  transcriptIsValid,
  DETECTION_VERSION,
} from '../media/pipeline-cache-identity';
import { buildHighlightSystemPrompt } from '../media/prompts/highlight-detection.prompts';
import { assertNotCancelled, drainMediaChildren } from './cancellation-context';
import { highlightPolicy } from '../media/highlight-policy';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob, UnrecoverableError } from 'bullmq';
import { SourceAuthorizationError } from '../billing/source-authorization';
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
  HighlightDetectionOptions,
  HighlightDetectionResult,
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
    @Optional() private cache?: PipelineCacheService,
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

      const extractedId = this.sourceVideoService.extractExternalId(
        job.sourcePlatform,
        job.sourceUrl,
      );
      const canonicalUrl = extractedId
        ? `https://www.youtube.com/watch?v=${extractedId}`
        : job.sourceUrl;
      const externalId =
        extractedId &&
        (await this.videoDownloadService.canShareSource(canonicalUrl))
          ? extractedId
          : null;
      let sourceVideo: SourceVideoDocument | null = null;
      const fileHash = async (file: string) => {
        const hash = createHash('sha256');
        for await (const chunk of fs.createReadStream(file)) {
          assertNotCancelled();
          hash.update(chunk as Buffer);
        }
        return hash.digest('hex');
      };
      let sourceVersion = '';
      let rejectedCachedMedia = false;
      const transcriptConfig = this.cache
        ? await this.transcriptionService.cacheConfiguration()
        : 'unit-test';
      const obtainTranscript = async () => {
        const create = () =>
          this.transcriptionService.transcribe(
            audioPath,
            makeThrottledProgressUpdate(),
          );
        const key = artifactHash({
          kind: 'transcript',
          sourceVersion,
          sourceIdentity: externalId
            ? `${job.sourcePlatform}:${externalId}`
            : null,
          transcriptConfig,
          scope: externalId ? 'public' : userId,
        });
        const actualDuration =
          (await this.jobsService.findJob(jobId))?.videoDuration ??
          job.videoDuration;
        const result = this.cache
          ? await this.cache.getOrCreate<TranscriptSegmentDto[]>({
              key,
              kind: 'transcript',
              sourceVersion,
              jobId,
              metadata: {
                configurationHash: transcriptConfig,
                sourceIdentityHash: artifactHash({
                  provider: job.sourcePlatform,
                  id: externalId ?? userId,
                }),
              },
              validate: (value): value is TranscriptSegmentDto[] =>
                Array.isArray(value) &&
                transcriptIsValid(
                  value as TranscriptSegmentDto[],
                  actualDuration,
                ),
              create,
            })
          : await create();
        return result;
      };

      let videoPath = '';
      let audioPath = '';
      let transcript: TranscriptSegmentDto[] = [];

      // Commit normalized metadata and a durable source before expensive AI work.
      const prepareSource = async (
        input: string,
        cached?: SourceVideoDocument,
      ) => {
        const latest = await this.jobsService.findJob(jobId);
        const metadata = await this.inspection.inspect(input);
        if (
          !metadata.hasVideo ||
          !Number.isFinite(metadata.durationSeconds) ||
          metadata.durationSeconds <= 0
        )
          throw new UnrecoverableError('Invalid source video metadata');
        const contentHash = await fileHash(input);
        if (cached?.contentHash && cached.contentHash !== contentHash)
          throw new Error('Cached source checksum mismatch');
        await this.jobsService.assertSourceBudget(
          jobId,
          metadata.durationSeconds,
        );
        sourceVersion = contentHash;
        const key =
          latest?.sourceObjectKey ??
          cached?.videoObjectKey ??
          (externalId
            ? `source-videos/${contentHash}/video.mp4`
            : `job-sources/${jobId}/${contentHash}.mp4`);
        if (
          !latest?.sourceObjectKey &&
          !cached &&
          (rejectedCachedMedia || !(await this.r2Service.fileExists(key)))
        ) {
          await this.cache?.assertLease();
          await this.r2Service.uploadFile(input, key);
        }
        assertNotCancelled();
        await this.jobsService.updateJob(jobId, {
          sourceObjectKey: key,
          sourceContentHash: contentHash,
          mediaMetadata: metadata,
          videoDuration: metadata.durationSeconds,
          workload: estimateVideoWorkload(metadata),
        });
        return metadata;
      };

      if (hasLocalVideo || job.sourceObjectKey) {
        videoPath = hasLocalVideo
          ? job.localVideoPath
          : path.join(jobDir, 'source.mp4');
        if (!hasLocalVideo)
          await this.r2Service.downloadToLocal(job.sourceObjectKey!, videoPath);
        await prepareSource(videoPath);
        const compatible =
          hasTranscript &&
          (!this.cache || job.transcriptSignature === transcriptConfig) &&
          transcriptIsValid(
            job.transcript,
            (await this.jobsService.findJob(jobId))!.videoDuration,
          );
        if (compatible) transcript = job.transcript;
        else {
          audioPath = hasLocalAudio
            ? job.localAudioPath
            : path.join(jobDir, 'audio.wav');
          if (!hasLocalAudio)
            await this.videoDownloadService.extractAudio(videoPath, audioPath);
          transcript = await obtainTranscript();
        }
        await this.jobsService.updateJob(jobId, {
          transcript,
          transcriptSignature: transcriptConfig,
          progressPercent: 100,
        });
      } else {
        // -----------------------------------------------------------------------
        // NO LOCAL RESUME STATE — fall through to the SourceVideo cache-hit path
        // (for YouTube) or a fresh download. This is the existing logic, fully
        // unchanged. Genuinely new jobs and retries where the disk was wiped both
        // land here.
        // -----------------------------------------------------------------------
        const prepareMedia = async () => {
          if (externalId) {
            sourceVideo = await this.sourceVideoService.findCached(
              job.sourcePlatform,
              externalId,
            );
          }
          if (
            sourceVideo &&
            job.creditSourceSeconds &&
            sourceVideo.videoDuration &&
            Math.abs(sourceVideo.videoDuration - job.creditSourceSeconds) >= 1
          ) {
            this.logger.log({
              event: 'cache.miss',
              layer: 'media',
              jobId,
              reason: 'source_duration_version_changed',
            });
            sourceVideo = null;
          }
          this.logger.log({
            event: 'cache.lookup',
            layer: 'media',
            jobId,
            found: !!sourceVideo,
            reason: externalId
              ? 'canonical_source'
              : 'private_or_uncacheable_source',
          });

          if (sourceVideo) {
            let cacheMediaValid = false;
            try {
              // -------------------------------------------------------------------
              // CACHE HIT — pull from R2 into this job's local temp dir.
              // Reuse the video; audio and transcript compatibility are checked separately.
              // -------------------------------------------------------------------
              this.logger.log(
                `[${jobId}] Media cache hit for ${job.sourcePlatform}:${externalId} from SourceVideo ${sourceVideo._id.toString()}`,
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
              await prepareSource(videoPath, sourceVideo);
              cacheMediaValid = true;
              this.logger.log({
                event: 'cache.hit',
                layer: 'media',
                jobId,
                sourceVersion,
              });
              let audioValid = false;
              if (sourceVideo.audioObjectKey) {
                try {
                  await this.r2Service.downloadToLocal(
                    sourceVideo.audioObjectKey,
                    audioPath,
                  );
                  const audioMetadata =
                    await this.inspection.inspect(audioPath);
                  audioValid =
                    !!sourceVideo.audioContentHash &&
                    audioMetadata.hasAudio &&
                    audioMetadata.durationSeconds > 0 &&
                    Math.abs(
                      audioMetadata.durationSeconds -
                        (sourceVideo.videoDuration || 0),
                    ) < 1 &&
                    (!sourceVideo.audioContentHash ||
                      (await fileHash(audioPath)) ===
                        sourceVideo.audioContentHash);
                } catch {
                  assertNotCancelled();
                }
              }
              this.logger.log({
                event: audioValid ? 'cache.hit' : 'cache.miss',
                layer: 'audio',
                jobId,
              });
              if (!audioValid) {
                await this.videoDownloadService.extractAudio(
                  videoPath,
                  audioPath,
                );
                const audioHash = await fileHash(audioPath);
                const audioKey = `source-videos/${sourceVersion}/audio-${audioHash}.wav`;
                await this.cache?.assertLease();
                await this.r2Service.uploadFile(audioPath, audioKey);
                await this.cache?.assertLease();
                await this.sourceVideoService.saveAudio(
                  sourceVideo._id.toString(),
                  audioKey,
                  audioHash,
                  sourceVersion,
                );
              }
              transcript = await obtainTranscript();
              await this.cache?.assertLease();
              await this.sourceVideoService.saveTranscript(
                sourceVideo._id.toString(),
                transcript,
                transcriptConfig,
                sourceVersion,
              );

              assertNotCancelled();
              await this.jobsService.updateJob(jobId, {
                sourceVideoId: sourceVideo._id,
                localVideoPath: videoPath,
                localAudioPath: audioPath,
                videoTitle: sourceVideo.videoTitle,
                videoUploader: sourceVideo.videoUploader,
                thumbnailUrl: sourceVideo.thumbnailUrl,
                transcript: transcript,
                transcriptSignature: transcriptConfig,
                resolutionUsed: resolution,
                progressPercent: 100,
              });
            } catch (cacheErr) {
              assertNotCancelled();
              if (cacheErr instanceof SourceAuthorizationError) throw cacheErr;
              if (cacheMediaValid) throw cacheErr;
              rejectedCachedMedia = true;
              this.logger.log({
                event: 'cache.miss',
                layer: 'media',
                jobId,
                reason: 'missing_or_invalid_artifact',
              });
              this.logger.warn(
                `[${jobId}] Failed to download cached files from R2 for SourceVideo ${sourceVideo._id.toString()} (${cacheErr instanceof Error ? cacheErr.message : cacheErr}); falling back to fresh processing.`,
              );
              sourceVideo = null;
            }
          }

          if (!sourceVideo) {
            this.logger.log({
              event: 'cache.miss',
              layer: 'media',
              jobId,
              reason: 'absent_expired_or_invalid',
            });
            this.logger.log({
              event: 'cache.miss',
              layer: 'audio',
              jobId,
              reason: 'fresh_source',
            });
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
            } = await this.videoDownloadService.downloadVideo(
              job.sourceUrl,
              jobDir,
              resolution,
              makeThrottledProgressUpdate(),
              job.creditSourceSeconds,
              !!extractedId && !externalId,
              true,
            );
            videoPath = dlVideoPath;
            audioPath = dlAudioPath;
            const measuredMetadata = await prepareSource(videoPath);
            const duration = measuredMetadata.durationSeconds;

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

            // Publish valid media independently: a failed ASR call must not lose the video cache.
            if (externalId) {
              await this.cache?.assertLease();
              sourceVideo = await this.sourceVideoService.createFromProcessing({
                platform: job.sourcePlatform,
                externalId,
                sourceUrl: canonicalUrl,
                contentHash: sourceVersion,
                videoObjectKey: `source-videos/${sourceVersion}/video.mp4`,
                audioObjectKey: '',
                transcript: [],
                videoTitle: title,
                videoUploader: uploader,
                thumbnailUrl,
                videoDuration: duration,
              });
              await this.jobsService.updateJob(jobId, {
                sourceVideoId: sourceVideo._id,
              });
            }
            if (!fs.existsSync(audioPath))
              await this.videoDownloadService.extractAudio(
                videoPath,
                audioPath,
              );
            const audioMetadata = await this.inspection.inspect(audioPath);
            if (
              !audioMetadata.hasAudio ||
              Math.abs(audioMetadata.durationSeconds - duration) >= 1
            )
              throw new Error('Extracted audio is incomplete or invalid');
            if (sourceVideo) {
              const audioHash = await fileHash(audioPath),
                audioKey = `source-videos/${sourceVersion}/audio-${audioHash}.wav`;
              await this.cache?.assertLease();
              await this.r2Service.uploadFile(audioPath, audioKey);
              await this.cache?.assertLease();
              await this.sourceVideoService.saveAudio(
                sourceVideo._id.toString(),
                audioKey,
                audioHash,
                sourceVersion,
              );
            }

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
              : await obtainTranscript();
            const transcriptDocs: TranscriptSegment[] = transcript.map((t) => ({
              startTime: t.startTime,
              endTime: t.endTime,
              text: t.text,
            }));
            assertNotCancelled();
            await this.jobsService.updateJob(jobId, {
              transcript: transcriptDocs,
              transcriptSignature: transcriptConfig,
              progressPercent: 100,
            });

            if (sourceVideo) {
              await this.cache?.assertLease();
              await this.sourceVideoService.saveTranscript(
                sourceVideo._id.toString(),
                transcript,
                transcriptConfig,
                sourceVersion,
              );
            }
          }
          return sourceVideo;
        };
        sourceVideo =
          this.cache && externalId
            ? await this.cache.withLock(
                `media:${job.sourcePlatform}:${externalId}`,
                prepareMedia,
              )
            : await prepareMedia();
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
      // to repeat (costs an API call every time).
      //
      // If highlights are missing (fresh job or failed before this stage),
      // use the versioned candidate pool and select against this job's authorization.
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

      const policy = highlightPolicy(user.plan, metadata.durationSeconds);
      const options: HighlightDetectionOptions = {
        videoDuration: metadata.durationSeconds,
        maxHighlights: job.clipTargetMax || policy.max,
        minHighlights: policy.min,
        maxOutputSeconds: job.creditOperationId
          ? job.creditOutputSeconds || 0
          : policy.outputSeconds,
        jobId,
        plan: user.plan,
      };
      if (effectiveHighlightPreset.highlightPrompt) {
        options.customPrompt = effectiveHighlightPreset.highlightPrompt;
      }
      const effectiveCustomPrompt = isPaidPlan
        ? normalizeInstructions(job.customPrompt)
        : '';
      options.customPrompt = [
        effectiveHighlightPreset.highlightPrompt,
        effectiveCustomPrompt,
      ]
        .filter(Boolean)
        .join('\n\n');
      if (isPaidPlan && job.aiModel && job.aiModel !== 'default') {
        if (ALLOWED_PAID_AI_MODELS.includes(job.aiModel)) {
          options.model = job.aiModel;
        } else {
          this.logger.warn(
            `[${jobId}] User requested aiModel="${job.aiModel}" which is not on the allowlist; using default.`,
          );
        }
      }

      if (job.highlightModel) {
        options.model = undefined;
        options.registeredModel = { userId, selection: job.highlightModel };
        await this.highlightDetectionService.verifySelection(
          userId,
          job.highlightModel,
        );
      }
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

        let detectionResult: HighlightDetectionResult;
        if (this.cache) {
          const highlightCacheKey = highlightIdentity({
            source: externalId
              ? `${job.sourcePlatform}:${externalId}:${sourceVersion}`
              : artifactHash({ sourceVersion, owner: userId }),
            transcript: artifactHash({
              segments: transcript,
              configuration: transcriptConfig,
            }),
            preset: effectivePresetKey,
            presetInstructions: effectiveHighlightPreset.highlightPrompt,
            customPrompt: effectiveCustomPrompt,
            owner: userId,
            template: artifactHash(
              buildHighlightSystemPrompt(metadata.durationSeconds, 24),
            ),
            configuration: this.highlightDetectionService.cacheConfiguration(
              options.model,
              job.highlightModel,
            ),
          });
          this.logger.log({
            event: 'highlights.configuration',
            jobId,
            preset: effectivePresetKey,
            algorithmVersion: DETECTION_VERSION,
          });
          detectionResult =
            await this.cache.getOrCreate<HighlightDetectionResult>({
              key: highlightCacheKey,
              kind: 'highlights',
              sourceVersion,
              jobId,
              metadata: {
                preset: effectivePresetKey,
                instructionsHash: artifactHash(
                  effectiveHighlightPreset.highlightPrompt,
                ),
                customPromptHash: artifactHash(effectiveCustomPrompt || null),
                algorithmVersion: DETECTION_VERSION,
                configurationHash: artifactHash(
                  this.highlightDetectionService.cacheConfiguration(
                    options.model,
                    job.highlightModel,
                  ),
                ),
                templateHash: artifactHash(
                  buildHighlightSystemPrompt(metadata.durationSeconds, 24),
                ),
                ...(effectiveCustomPrompt
                  ? { ownerHash: artifactHash(userId) }
                  : {}),
              },
              validate: (value): value is HighlightDetectionResult =>
                this.highlightDetectionService.candidateArtifactIsValid(
                  value,
                  transcript,
                  options,
                ),
              create: () =>
                this.highlightDetectionService.discoverCandidatesWithMetadata(
                  transcript,
                  options,
                ),
              cacheable: (value) => value.cacheable !== false,
            });
          highlights = this.highlightDetectionService.selectCandidates(
            detectionResult.candidates ?? [],
            transcript,
            options,
          );
        } else {
          // Directly constructed test workers retain the public detection entry point.
          detectionResult =
            await this.highlightDetectionService.detectHighlightsWithMetadata(
              transcript,
              options,
            );
          highlights = detectionResult.highlights;
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
      if (err instanceof SourceAuthorizationError)
        await this.jobsService.updateJob(jobId, {
          measuredSourceSeconds: err.measuredSeconds,
        });
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

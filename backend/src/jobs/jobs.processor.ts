import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob } from 'bullmq';
import { Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { JOBS_QUEUE, JOBS_TYPES, ALLOWED_PAID_AI_MODELS } from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobStatus, Clip, TranscriptSegment } from './schemas/job.schema';
import { SourceVideoDocument } from './schemas/source-video.schema';
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import { VideoDownloadService } from '../media/services/video-download.service';
import { TranscriptionService, TranscriptSegmentDto } from '../media/services/transcription.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { HighlightDetectionService, HighlightDto } from '../media/services/highlight-detection.service';
import { ClipCuttingService } from '../media/services/clip-cutting.service';
import { SourceVideoService } from '../media/services/source-video.service';
import { R2Service } from '../storage/r2.service';
import { resolveStylePreset, DEFAULT_STYLE_PRESET_KEY } from '../media/style-presets';
import { resolveEditorStyle } from '../media/editor-styles';

type ClipDraft = {
  highlight: HighlightDto;
  localFilePath?: string;
  captionedFilePath?: string;
  r2ObjectKey?: string; // set after successful R2 upload of the captioned (or raw) clip
  status: JobStatus;
  errorMessage?: string;
};

@Processor(JOBS_QUEUE, {
  concurrency: 2,
  lockDuration: 60_000, // ms a job can be "locked" by a worker before considered stalled
  stalledInterval: 30_000, // how often BullMQ checks for stalled jobs
  maxStalledCount: 1, // after this many stall-detections, job is marked FAILED
})
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
    private configService: ConfigService,
    private videoDownloadService: VideoDownloadService,
    private transcriptionService: TranscriptionService,
    private captionBurningService: CaptionBurningService,
    private highlightDetectionService: HighlightDetectionService,
    private clipCuttingService: ClipCuttingService,
    private sourceVideoService: SourceVideoService,
    private r2Service: R2Service,
  ) {
    super();
  }

  async process(bullJob: BullJob): Promise<void> {
    switch (bullJob.name) {
      case JOBS_TYPES.CLIP_VIDEO: {
        const { jobId } = bullJob.data;
        await this.processClipVideoJob(jobId);
        break;
      }
      default:
        throw new Error(`Unknown job type: ${bullJob.name}`);
    }
  }

  private async processClipVideoJob(jobId: string): Promise<void> {
    const job = await this.jobsService.updateJob(jobId, {
      status: JobStatus.PENDING,
      errorMessage: undefined,
      errorStage: undefined,
    });
    if (!job) throw new Error(`Job ${jobId} not found at process start`);

    const userId = job.userId.toString();
    const storageRoot = this.configService.get<string>('STORAGE_ROOT', '/var/blynta/storage');
    const jobDir = path.join(storageRoot, 'jobs', jobId);
    const clipsDir = path.join(jobDir, 'clips');

    try {
      await fs.promises.mkdir(clipsDir, { recursive: true });

      // --- User & Plan resolution lookup ---
      const user = await this.usersService.findById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      // const resolution: '720p' | '1080p' =
      //   user.plan === UserPlan.PRO || user.plan === UserPlan.BUSINESS ? '1080p' : '720p';
      const resolution: '720p' | '1080p' | '360p' | '240p' = '240p';

      let lastProgressUpdate = 0;
      const makeThrottledProgressUpdate = () => async (percent: number) => {
        this.logger.debug(`[${jobId}] Raw progress callback fired: ${percent}%`);
        const now = Date.now();
        if (now - lastProgressUpdate < 2000) return;
        lastProgressUpdate = now;
        await this.jobsService.updateJob(jobId, { progressPercent: Math.round(percent) });
      };

      // =========================================================================
      // Resume-state detection — check DB fields AND verify files still exist on
      // disk before trusting them. Trusting DB alone risks ENOENT crashes deep in
      // a later stage if the volume was wiped between failure and retry.
      // =========================================================================
      const hasLocalVideo = Boolean(job.localVideoPath && fs.existsSync(job.localVideoPath));
      const hasLocalAudio = Boolean(job.localAudioPath && fs.existsSync(job.localAudioPath));
      const hasTranscript = Boolean(job.transcript && job.transcript.length > 0);
      const hasHighlights = Boolean(job.highlights && job.highlights.length > 0);

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

      if (hasLocalVideo && hasLocalAudio && hasTranscript) {
        // -----------------------------------------------------------------------
        // RESUME (full) — both download AND transcription already completed on
        // a prior attempt and local files are still on disk. Most valuable skip:
        // transcription is the slowest/most resource-heavy local stage.
        // -----------------------------------------------------------------------
        this.logger.log(`[${jobId}] Resuming: skipping download + transcription (already complete on disk)`);
        videoPath = job.localVideoPath!;
        audioPath = job.localAudioPath!;
        transcript = job.transcript as TranscriptSegmentDto[];
        await this.jobsService.updateJob(jobId, { progressPercent: 100 });
      } else if (hasLocalVideo && hasLocalAudio) {
        // -----------------------------------------------------------------------
        // RESUME (partial) — download succeeded, transcription didn't (or its DB
        // output is missing). Skip download only; re-run transcription.
        // -----------------------------------------------------------------------
        this.logger.log(`[${jobId}] Resuming: skipping download, re-running transcription`);
        videoPath = job.localVideoPath!;
        audioPath = job.localAudioPath!;

        this.logger.log(`[${jobId}] Stage 2/5: Transcribing audio (resumed)`);
        lastProgressUpdate = 0;
        await this.jobsService.updateJob(jobId, { status: JobStatus.TRANSCRIBING, progressPercent: 0 });

        transcript = await this.transcriptionService.transcribe(
          audioPath,
          makeThrottledProgressUpdate(),
        );
        const transcriptDocsResumed: TranscriptSegment[] = transcript.map((t) => ({
          startTime: t.startTime,
          endTime: t.endTime,
          text: t.text,
        }));
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
              `[${jobId}] Cache hit for ${job.sourcePlatform}:${externalId} — reusing video, audio, transcript from SourceVideo ${sourceVideo._id}`,
            );
            await this.sourceVideoService.recordReuse(sourceVideo._id.toString());

            videoPath = path.join(jobDir, 'source.mp4');
            audioPath = path.join(jobDir, 'audio.wav');

            this.logger.log(`[${jobId}] Downloading cached files from R2...`);
            await this.r2Service.downloadToLocal(sourceVideo.videoObjectKey, videoPath);
            await this.r2Service.downloadToLocal(sourceVideo.audioObjectKey, audioPath);

            transcript = sourceVideo.transcript as TranscriptSegmentDto[];

            await this.jobsService.updateJob(jobId, {
              sourceVideoId: sourceVideo._id,
              localVideoPath: videoPath,
              localAudioPath: audioPath,
              videoTitle: sourceVideo.videoTitle,
              videoUploader: sourceVideo.videoUploader,
              transcript: transcript as any,
              resolutionUsed: resolution,
              progressPercent: 100,
            });
          } catch (cacheErr) {
            this.logger.warn(
              `[${jobId}] Failed to download cached files from R2 for SourceVideo ${sourceVideo._id} (${cacheErr instanceof Error ? cacheErr.message : cacheErr}); falling back to fresh processing.`,
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
          this.logger.log(`[${jobId}] Stage 1/5: Downloading video (${resolution})`);
          await this.jobsService.updateJob(jobId, {
            status: JobStatus.PENDING,
            progressPercent: 0,
            resolutionUsed: resolution,
          });

          const { videoPath: dlVideoPath, audioPath: dlAudioPath, title, uploader } =
            await this.videoDownloadService.downloadVideo(
              job.sourceUrl,
              jobDir,
              resolution,
              makeThrottledProgressUpdate(),
            );
          videoPath = dlVideoPath;
          audioPath = dlAudioPath;

          await this.jobsService.updateJob(jobId, {
            localVideoPath: videoPath,
            localAudioPath: audioPath,
            videoTitle: title,
            videoUploader: uploader,
            progressPercent: 100,
          });

          // --- Stage 2: Transcribe ---
          this.logger.log(`[${jobId}] Stage 2/5: Transcribing audio`);
          lastProgressUpdate = 0;
          await this.jobsService.updateJob(jobId, {
            status: JobStatus.TRANSCRIBING,
            progressPercent: 0,
          });

          transcript = await this.transcriptionService.transcribe(
            audioPath,
            makeThrottledProgressUpdate(),
          );
          const transcriptDocs: TranscriptSegment[] = transcript.map((t) => ({
            startTime: t.startTime,
            endTime: t.endTime,
            text: t.text,
          }));
          await this.jobsService.updateJob(jobId, {
            transcript: transcriptDocs,
            progressPercent: 100,
          });

          // ONLY cache if this platform actually supports it (YouTube — externalId is non-null)
          if (externalId) {
            this.logger.log(`[${jobId}] Uploading source video + audio to R2 for caching`);
            const videoObjectKey = `source-videos/${externalId}/video.mp4`;
            const audioObjectKey = `source-videos/${externalId}/audio.wav`;

            await this.r2Service.uploadFile(videoPath, videoObjectKey);
            await this.r2Service.uploadFile(audioPath, audioObjectKey);

            const newSourceVideo = await this.sourceVideoService.createFromProcessing({
              platform: job.sourcePlatform,
              externalId,
              sourceUrl: job.sourceUrl,
              videoObjectKey,
              audioObjectKey,
              transcript,
              videoTitle: title,
              videoUploader: uploader,
            });
            await this.jobsService.updateJob(jobId, {
              sourceVideoId: newSourceVideo._id,
            });
            sourceVideo = newSourceVideo;
            this.logger.log(
              `[${jobId}] SourceVideo created: ${newSourceVideo._id} (key: ${videoObjectKey})`,
            );
          }
        }
      }

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

      const isPaidPlan = user.plan === UserPlan.PRO || user.plan === UserPlan.BUSINESS;
      const requestedPreset = resolveStylePreset(job.stylePreset);
      let effectivePresetKey = requestedPreset.key;

      if (requestedPreset.isPro && !isPaidPlan) {
        this.logger.warn(
          `[${jobId}] User requested stylePreset="${requestedPreset.key}" which is Pro-only; falling back to default highlight prompt (caption style is kept).`,
        );
        effectivePresetKey = DEFAULT_STYLE_PRESET_KEY;
      }
      const effectiveHighlightPreset = resolveStylePreset(effectivePresetKey);

      let options: { customPrompt?: string; model?: string } | undefined;
      options = {};
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
        isPaidPlan && (job.customPrompt || (job.aiModel && job.aiModel !== 'default') || requestedPreset.isPro);

      let highlights: HighlightDto[] = [];

      if (hasHighlights) {
        // -----------------------------------------------------------------------
        // RESUME — highlights already detected and persisted on a prior attempt.
        // Skip the LLM call; re-use what's already in the DB.
        // -----------------------------------------------------------------------
        this.logger.log(
          `[${jobId}] Resuming: skipping highlight detection (already have ${job.highlights.length} highlight(s))`,
        );
        highlights = job.highlights as HighlightDto[];
        await this.jobsService.updateJob(jobId, { status: JobStatus.DETECTING_HIGHLIGHTS });
      } else {
        await this.jobsService.updateJob(jobId, { status: JobStatus.DETECTING_HIGHLIGHTS });

        const presetMap = sourceVideo?.defaultHighlightsByPreset;
        const cachedHighlights = (
          presetMap instanceof Map
            ? presetMap.get(effectivePresetKey)
            : (presetMap as any)?.[effectivePresetKey]
        ) as HighlightDto[] | undefined;
        let detectionResult: { videoTitle?: string; videoDescription?: string; keywords?: string; hashtags?: string[]; highlights: HighlightDto[] } | null = null;

        if (sourceVideo && !usingCustomOptions && cachedHighlights && cachedHighlights.length > 0) {
          this.logger.log(
            `[${jobId}] Reusing cached highlights for preset "${effectivePresetKey}" from SourceVideo ${sourceVideo._id}`,
          );
          highlights = cachedHighlights;
        } else {
          detectionResult = await this.highlightDetectionService.detectHighlightsWithMetadata(transcript, options);
          highlights = detectionResult.highlights;

          // Save default highlights on the SourceVideo so future jobs with this video skip the LLM call
          if (!usingCustomOptions && sourceVideo) {
            await this.sourceVideoService.saveDefaultHighlights(
              sourceVideo._id.toString(),
              effectivePresetKey,
              highlights,
            );
            this.logger.log(
              `[${jobId}] Saved highlights for preset "${effectivePresetKey}" to SourceVideo ${sourceVideo._id}`,
            );
          }
        }

        await this.jobsService.updateJob(jobId, {
          ...(detectionResult?.videoDescription ? { videoDescription: detectionResult.videoDescription } : {}),
          ...(detectionResult?.keywords ? { keywords: detectionResult.keywords } : {}),
          ...(detectionResult?.hashtags && detectionResult.hashtags.length > 0 ? { hashtags: detectionResult.hashtags } : {}),
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

      // =========================================================================
      // Stage 4: Cut + caption clips
      //
      // ffmpeg operates on local files — videoPath is the local copy pulled either
      // from R2 (cache hit) or left on disk (cache miss). After each clip is
      // successfully captioned, upload it to R2 under clips/<jobId>/...
      // =========================================================================
      this.logger.log(`[${jobId}] Stage 4/5: Cutting ${highlights.length} clip(s)`);
      await this.jobsService.updateJob(jobId, { status: JobStatus.CUTTING_CLIPS });

      // -----------------------------------------------------------------------
      // Build clipDrafts from existing job.clips where possible (resume path).
      // A clip that was already COMPLETED with a valid R2 upload is marked as
      // done up-front; the cutting loop will persist its doc and continue
      // without re-running cutClip/burnCaptions/uploadFile.
      // Fresh jobs (no prior clips) fall through to the identical PENDING draft.
      // -----------------------------------------------------------------------
      const existingClips = job.clips ?? [];
      const clipDrafts: ClipDraft[] = highlights.map((h, i) => {
        const existing = existingClips[i];
        if (existing && existing.status === JobStatus.COMPLETED && existing.r2ObjectKey) {
          this.logger.log(
            `[${jobId}]   Clip ${i + 1} already completed (${existing.r2ObjectKey}) — skipping cut/caption/upload`,
          );
          return {
            highlight: h,
            status: JobStatus.COMPLETED,
            localFilePath: existing.localFilePath,
            captionedFilePath: existing.captionedFilePath,
            r2ObjectKey: existing.r2ObjectKey,
          };
        }
        return { highlight: h, status: JobStatus.PENDING };
      });

      const apiBaseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:5001');
      const clipDocs: Clip[] = []; // now built incrementally, not after the loop

      for (let i = 0; i < clipDrafts.length; i++) {
        const draft = clipDrafts[i];
        const h = draft.highlight;
        const rawClipPath = path.join(clipsDir, `clip-${i + 1}.mp4`);
        const captionedClipPath = path.join(clipsDir, `clip-${i + 1}-captioned.mp4`);
        const clipId = new Types.ObjectId();

        if (draft.status !== JobStatus.COMPLETED) {
          // Not yet completed — run the full cut/caption/upload pipeline.
          try {
            this.logger.log(
              `[${jobId}]   Cutting clip ${i + 1}/${clipDrafts.length}: ${h.startTime.toFixed(1)}s - ${h.endTime.toFixed(1)}s`,
            );
            await this.clipCuttingService.cutClip(
              videoPath,
              h.startTime,
              h.endTime,
              rawClipPath,
            );
            draft.localFilePath = rawClipPath;

            const relevantSegments = this.extractSegmentsForHighlight(
              transcript,
              h.startTime,
              h.endTime,
            );

            let finalLocalPath: string;
            if (relevantSegments.length > 0) {
              const editorStyle = resolveEditorStyle(h.style);
              const captionStyle =
                requestedPreset.key !== DEFAULT_STYLE_PRESET_KEY
                  ? requestedPreset.captionStyle
                  : editorStyle.captionStyle;

              this.logger.log(
                `[${jobId}]   Burning captions for clip ${i + 1} (preset=${requestedPreset.key}, editorStyle=${editorStyle.key})`,
              );
              await this.captionBurningService.burnCaptions(
                rawClipPath,
                relevantSegments,
                captionedClipPath,
                captionStyle,
              );
              draft.captionedFilePath = captionedClipPath;
              finalLocalPath = captionedClipPath;
            } else {
              this.logger.warn(
                `[${jobId}]   Clip ${i + 1} has no transcript segments; skipping caption burn.`,
              );
              finalLocalPath = rawClipPath;
            }

            // Upload finished clip to R2. Key is deterministic and collision-safe:
            // jobId is a unique MongoDB ObjectId, so clips/<jobId>/... never collides.
            const clipObjectKey = `clips/${jobId}/clip-${i + 1}-captioned.mp4`;
            await this.r2Service.uploadFile(finalLocalPath, clipObjectKey);
            draft.r2ObjectKey = clipObjectKey;
            this.logger.log(`[${jobId}]   Clip ${i + 1} uploaded to R2: ${clipObjectKey}`);

            draft.status = JobStatus.COMPLETED;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[${jobId}]   Clip ${i + 1} failed: ${msg}`);
            draft.status = JobStatus.FAILED;
            draft.errorMessage = msg;
          }
        }
        // else: clip was already COMPLETED from a prior attempt — skip cut/caption/upload
        // but still fall through to build + persist the clipDoc below so the full
        // clips array is always written back on every loop iteration.

        // Build and persist THIS clip's doc immediately — do not wait for remaining clips.
        const downloadUrl = `${apiBaseUrl}/jobs/${jobId}/clips/${clipId}/download`;
        const clipDoc: Clip = {
          _id: clipId,
          startTime: draft.highlight.startTime,
          endTime: draft.highlight.endTime,
          localFilePath: draft.localFilePath,
          captionedFilePath: draft.captionedFilePath,
          r2ObjectKey: draft.r2ObjectKey,
          downloadUrl,
          hasCaptions: Boolean(draft.captionedFilePath),
          status: draft.status,
          outputUrl: draft.r2ObjectKey,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Clip;
        clipDocs.push(clipDoc);

        // Push the growing clips array so the frontend sees this clip the moment it's ready.
        await this.jobsService.updateJob(jobId, { clips: clipDocs });
        this.logger.log(`[${jobId}]   Persisted clip ${i + 1}/${clipDrafts.length} (status=${draft.status})`);
      }

      const anyClipSucceeded = clipDocs.some((c) => c.status === JobStatus.COMPLETED);

      // --- Stage 5: Complete ---
      this.logger.log(`[${jobId}] Stage 5/5: Finalizing`);
      await this.jobsService.updateJob(jobId, {
        status: anyClipSucceeded ? JobStatus.COMPLETED : JobStatus.FAILED,
        clips: clipDocs, // redundant with the last loop iteration's write, kept for clarity/safety
        ...(anyClipSucceeded
          ? {}
          : { errorMessage: 'All clips failed to cut', errorStage: 'cutting_clips' }),
      });

      this.logger.log(
        `[${jobId}] Pipeline finished (status=${anyClipSucceeded ? 'COMPLETED' : 'FAILED'})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`[${jobId}] Pipeline FAILED: ${msg}`, stack);

      let stage = 'unknown';
      try {
        const latest = await this.jobsService.updateJob(jobId, {});
        if (latest) {
          const current = latest.status;
          if (current === JobStatus.PENDING) stage = 'download';
          else if (current === JobStatus.TRANSCRIBING) stage = 'transcription';
          else if (current === JobStatus.DETECTING_HIGHLIGHTS) stage = 'highlight_detection';
          else if (current === JobStatus.CUTTING_CLIPS) stage = 'cutting_clips';
        }
      } catch { }

      await this.jobsService.updateJob(jobId, {
        status: JobStatus.FAILED,
        errorMessage: msg,
        errorStage: stage,
      });
    } finally {
      // -------------------------------------------------------------------------
      // Local temp cleanup — only runs on COMPLETED jobs.
      //
      // On failure, the jobDir is left in place so that a subsequent retry can
      // resume from existing local files (video, audio, clips) rather than
      // re-downloading and re-transcribing from scratch.
      //
      // Abandoned FAILED dirs that are never retried are swept by the nightly
      // TTL cron in JobsReconciliationService.sweepAbandonedFailedJobDirs().
      //
      // Local disk is purely a transient working area for ffmpeg/whisper.cpp.
      // Durable copies of source videos live in R2 (under source-videos/<externalId>/)
      // and clips live in R2 (under clips/<jobId>/).
      //
      // SourceVideo-level R2 cleanup (evicting stale source-videos/... objects)
      // is a SEPARATE future concern that requires a background cron — NOT done here.
      // -------------------------------------------------------------------------
      const finalJobState = await this.jobsService.updateJob(jobId, {});
      const succeeded = finalJobState?.status === JobStatus.COMPLETED;

      if (succeeded) {
        try {
          await fs.promises.rm(jobDir, { recursive: true, force: true });
          this.logger.log(`[${jobId}] Cleaned up local temp directory: ${jobDir}`);
        } catch (err) {
          this.logger.warn(
            `[${jobId}] Failed to clean up local temp directory: ${err instanceof Error ? err.message : err}`,
          );
        }
      } else {
        this.logger.log(
          `[${jobId}] Job did not complete — leaving ${jobDir} in place for possible retry/resume.`,
        );
      }
    }
  }

  private extractSegmentsForHighlight(
    transcript: TranscriptSegmentDto[],
    hlStart: number,
    hlEnd: number,
  ): TranscriptSegmentDto[] {
    return transcript
      .filter((seg) => seg.endTime >= hlStart && seg.startTime <= hlEnd)
      .map((seg) => {
        const overlapStart = Math.max(seg.startTime, hlStart);
        const overlapEnd = Math.min(seg.endTime, hlEnd);
        return {
          startTime: Math.max(0, overlapStart - hlStart),
          endTime: Math.max(0, overlapEnd - hlStart),
          text: seg.text,
        };
      })
      .filter((seg) => seg.endTime > seg.startTime);
  }
}

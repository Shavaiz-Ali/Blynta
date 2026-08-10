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
import { UsersService } from '../users/users.service';
import { UserPlan } from '../users/schemas/user.schema';
import { VideoDownloadService } from '../media/services/video-download.service';
import { TranscriptionService, TranscriptSegmentDto } from '../media/services/transcription.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { HighlightDetectionService, HighlightDto } from '../media/services/highlight-detection.service';
import { ClipCuttingService } from '../media/services/clip-cutting.service';

type ClipDraft = {
  highlight: HighlightDto;
  localFilePath?: string;
  captionedFilePath?: string;
  status: JobStatus;
  errorMessage?: string;
};

@Processor(JOBS_QUEUE)
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
      // TODO(disk-cleanup): Implement a scheduled cron that deletes job directories
      // older than N days (e.g. 7-14). VPS disk is finite — unbounded retention will
      // fill the disk. At minimum, also expose a DELETE /jobs/:id route that calls
      // fs.rm(jobDir, { recursive: true, force: true }) for user-initiated cleanup.

      await fs.promises.mkdir(clipsDir, { recursive: true });
      const apiBaseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:5001');

      // --- Stage 1: Download ---
      this.logger.log(`[${jobId}] Stage 1/5: Downloading video`);
      await this.jobsService.updateJob(jobId, { status: JobStatus.PENDING });
      const { videoPath, audioPath } = await this.videoDownloadService.downloadVideo(
        job.sourceUrl,
        jobDir,
      );
      await this.jobsService.updateJob(jobId, {
        localVideoPath: videoPath,
        localAudioPath: audioPath,
      });

      // --- Stage 2: Transcribe ---
      this.logger.log(`[${jobId}] Stage 2/5: Transcribing audio`);
      await this.jobsService.updateJob(jobId, { status: JobStatus.TRANSCRIBING });
      const transcript = await this.transcriptionService.transcribe(audioPath);
      const transcriptDocs: TranscriptSegment[] = transcript.map((t) => ({
        startTime: t.startTime,
        endTime: t.endTime,
        text: t.text,
      }));
      await this.jobsService.updateJob(jobId, { transcript: transcriptDocs });

      // --- Stage 3: Highlight detection ---
      this.logger.log(`[${jobId}] Stage 3/5: Detecting highlights`);
      await this.jobsService.updateJob(jobId, { status: JobStatus.DETECTING_HIGHLIGHTS });
      const user = await this.usersService.findById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      const isPaidPlan = user.plan === UserPlan.PRO || user.plan === UserPlan.BUSINESS;
      let options: { customPrompt?: string; model?: string } | undefined;

      if (isPaidPlan) {
        options = {};
        if (job.customPrompt) options.customPrompt = job.customPrompt;
        if (job.aiModel && job.aiModel !== 'default') {
          if (ALLOWED_PAID_AI_MODELS.includes(job.aiModel)) {
            options.model = job.aiModel;
          } else {
            this.logger.warn(
              `[${jobId}] User requested aiModel="${job.aiModel}" which is not on the allowlist; using default.`,
            );
          }
        }
      }

      const highlights = await this.highlightDetectionService.detectHighlights(
        transcript,
        options,
      );
      await this.jobsService.updateJob(jobId, {
        highlights: highlights.map((h) => ({
          startTime: h.startTime,
          endTime: h.endTime,
          reason: h.reason,
          score: h.score,
        })),
      });

      // --- Stage 4: Cut + caption clips ---
      this.logger.log(`[${jobId}] Stage 4/5: Cutting ${highlights.length} clip(s)`);
      await this.jobsService.updateJob(jobId, { status: JobStatus.CUTTING_CLIPS });

      const clipDrafts: ClipDraft[] = highlights.map((h) => ({
        highlight: h,
        status: JobStatus.PENDING,
      }));

      for (let i = 0; i < clipDrafts.length; i++) {
        const draft = clipDrafts[i];
        const h = draft.highlight;
        const rawClipPath = path.join(clipsDir, `clip-${i + 1}.mp4`);
        const captionedClipPath = path.join(clipsDir, `clip-${i + 1}-captioned.mp4`);

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

          if (relevantSegments.length > 0) {
            this.logger.log(`[${jobId}]   Burning captions for clip ${i + 1}`);
            await this.captionBurningService.burnCaptions(
              rawClipPath,
              relevantSegments,
              captionedClipPath,
            );
            draft.captionedFilePath = captionedClipPath;
          } else {
            this.logger.warn(`[${jobId}]   Clip ${i + 1} has no transcript segments; skipping caption burn.`);
          }

          draft.status = JobStatus.COMPLETED;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`[${jobId}]   Clip ${i + 1} failed: ${msg}`);
          draft.status = JobStatus.FAILED;
          draft.errorMessage = msg;
        }
      }

      // Build Clip subdocuments with download URLs
      const clipDocs: Clip[] = clipDrafts.map((draft, i) => {
        const clipId = new Types.ObjectId();
        const downloadUrl = `${apiBaseUrl}/jobs/${jobId}/clips/${clipId}/download`;
        return {
          _id: clipId,
          startTime: draft.highlight.startTime,
          endTime: draft.highlight.endTime,
          localFilePath: draft.localFilePath,
          captionedFilePath: draft.captionedFilePath,
          downloadUrl,
          hasCaptions: Boolean(draft.captionedFilePath),
          status: draft.status,
          outputUrl: draft.captionedFilePath || draft.localFilePath || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Clip;
      });

      const anyClipSucceeded = clipDocs.some((c) => c.status === JobStatus.COMPLETED);

      // --- Stage 5: Complete ---
      this.logger.log(`[${jobId}] Stage 5/5: Finalizing`);
      await this.jobsService.updateJob(jobId, {
        status: anyClipSucceeded ? JobStatus.COMPLETED : JobStatus.FAILED,
        clips: clipDocs,
        ...(anyClipSucceeded
          ? {}
          : { errorMessage: 'All clips failed to cut', errorStage: 'cutting_clips' }),
      });

      this.logger.log(`[${jobId}] Pipeline finished (status=${anyClipSucceeded ? 'COMPLETED' : 'FAILED'})`);
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
      } catch {}

      await this.jobsService.updateJob(jobId, {
        status: JobStatus.FAILED,
        errorMessage: msg,
        errorStage: stage,
      });
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

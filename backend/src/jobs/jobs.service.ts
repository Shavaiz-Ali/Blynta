import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Job, JobDocument, JobStatus, Clip } from './schemas/job.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { JobAccessDeniedException } from '../common/exceptions';
import { UsersService } from '../users/users.service';
import { JOBS_QUEUE, JOBS_TYPES } from './jobs.constants';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue(JOBS_QUEUE) private jobsQueue: Queue,
    private usersService: UsersService,
    private configService: ConfigService,
    private r2Service: R2Service,
    private activitiesService: ActivitiesService,
  ) { }

  async createJob(userId: string, dto: CreateJobDto): Promise<JobDocument> {
    await this.usersService.deductCredit(userId);

    const job = new this.jobModel({
      userId: new Types.ObjectId(userId),
      sourceUrl: dto.sourceUrl,
      sourcePlatform: dto.sourcePlatform,
      status: JobStatus.PENDING,
      customPrompt: dto.customPrompt,
      aiModel: dto.aiModel,
      stylePreset: dto.stylePreset || 'default',
      resolutionUsed: dto.resolution,
      progressPercent: 0,
    });
    const saved = await job.save();

    await this.jobsQueue.add(JOBS_TYPES.CLIP_VIDEO, {
      jobId: saved._id.toString(),
      userId,
    });

    // Activities for Job Creation and Credit Usage
    await this.activitiesService.queueCreate({
      userId: saved.userId,
      type: ActivityType.JOB_CREATE,
      category: ActivityCategory.JOB,
      title: 'Clip generation started',
      description: 'Your video is being processed.',
      activityUrl: `/dashboard/jobs/${saved._id}`,
      entityType: 'job',
      entityId: saved._id,
      actorType: ActivityActorType.USER,
      actorId: saved.userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: {
        sourcePlatform: dto.sourcePlatform,
        aiModel: dto.aiModel,
        stylePreset: dto.stylePreset || 'default',
      },
    });

    await this.activitiesService.queueCreate({
      userId: saved.userId,
      type: ActivityType.CREDIT_DEDUCT,
      category: ActivityCategory.CREDIT,
      title: 'Credit used',
      description: '1 credit used for video clip generation.',
      activityUrl: '/billing',
      entityType: 'job',
      entityId: saved._id,
      actorType: ActivityActorType.USER,
      actorId: saved.userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: {
        amount: 1,
        jobId: saved._id.toString(),
      },
    });

    return saved;
  }

  async getJobById(userId: string, jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId.toString() !== userId) {
      throw new JobAccessDeniedException();
    }
    return job;
  }

  // Task 1 — paginated + filterable job list
  async getJobsForUser(
    userId: string,
    options?: { status?: JobStatus; page?: number; limit?: number },
  ): Promise<{
    jobs: JobDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (options?.status) filter.status = options.status;

    const [jobs, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.jobModel.countDocuments(filter).exec(),
    ]);

    return { jobs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateJob(
    jobId: string,
    updates: Partial<Job>,
  ): Promise<JobDocument | null> {
    return this.jobModel
      .findByIdAndUpdate(jobId, updates, { returnDocument: 'after' })
      .exec();
  }

  async findStuckJobs(
    statuses: JobStatus[],
    cutoff: Date,
  ): Promise<JobDocument[]> {
    return this.jobModel
      .find({
        status: { $in: statuses },
        updatedAt: { $lt: cutoff },
      })
      .exec();
  }

  async getClipForDownload(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ clip: Clip }> {
    const job = await this.getJobById(userId, jobId);
    const clip = job.clips.find((c) => c._id.toString() === clipId);
    if (!clip) throw new NotFoundException('Clip not found');
    // clip.r2ObjectKey is the R2 object key for the captioned (or raw) clip.
    // The controller depends on this field being present to call r2Service.getSignedDownloadUrl().
    if (!clip.r2ObjectKey) throw new NotFoundException('Clip file not ready');
    return { clip };
  }

  // Task 2 — delete an entire job + its clips from R2
  async deleteJob(
    userId: string,
    jobId: string,
  ): Promise<{ message: string }> {
    const job = await this.getJobById(userId, jobId); // ownership check + NotFoundException

    const activeStatuses: JobStatus[] = [
      JobStatus.PENDING,
      JobStatus.TRANSCRIBING,
      JobStatus.DETECTING_HIGHLIGHTS,
      JobStatus.CUTTING_CLIPS,
    ];
    if (activeStatuses.includes(job.status)) {
      throw new ConflictException(
        'Cannot delete a job that is still processing',
      );
    }

    // Local disk cleanup:
    // For COMPLETED jobs the local temp directory was already cleaned up at the
    // end of JobsProcessor.processClipVideoJob() (finally block, success path).
    // For FAILED jobs the dir is intentionally kept so that a retry can resume
    // from existing local files. Attempting fs.rm here with force:true is still
    // correct for both cases: it's a no-op for completed jobs (dir already gone)
    // and it ensures the dir is cleaned for FAILED jobs that are being deleted
    // without ever being retried — avoiding a permanent disk leak.
    // For active jobs we already throw ConflictException above, so we won't reach here.
    if (!activeStatuses.includes(job.status)) {
      const storageRoot = this.configService.get<string>(
        'STORAGE_ROOT',
        '/var/blynta/storage',
      );
      const jobDir = path.join(storageRoot, 'jobs', jobId);
      try {
        // Expected behaviour: directory won't exist for completed/failed jobs since
        // the processor's finally block already removed it. force:true makes this a no-op
        // rather than an error, which is correct and intentional.
        await fs.promises.rm(jobDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(
          `Failed to delete job directory ${jobDir}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Delete each clip's R2 object.
    // IMPORTANT: We do NOT delete the SourceVideo record or its associated
    // source-videos/<externalId>/... R2 objects, even if this job was the last one
    // referencing them. SourceVideo entries are shared across jobs and users;
    // per-job deletion must never cascade to the shared cache. SourceVideo-level
    // R2 cleanup is a separate future concern (background cron by referenceCount/age).
    for (const clip of job.clips) {
      if (clip.r2ObjectKey) {
        try {
          await this.r2Service.deleteFile(clip.r2ObjectKey);
        } catch (err) {
          this.logger.warn(
            `Failed to delete R2 object ${clip.r2ObjectKey}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    await this.jobModel.findByIdAndDelete(jobId).exec();

    await this.activitiesService.queueCreate({
      userId: job.userId,
      type: ActivityType.JOB_DELETE,
      category: ActivityCategory.JOB,
      title: 'Job deleted',
      description: 'Video processing job was deleted.',
      activityUrl: '/dashboard',
      entityType: 'job',
      entityId: job._id,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { message: 'Job deleted successfully' };
  }

  // Task 3 — delete a single clip within a job
  async deleteClip(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ message: string }> {
    const job = await this.getJobById(userId, jobId);
    const clip = job.clips.find((c) => c._id.toString() === clipId);
    if (!clip) throw new NotFoundException('Clip not found');

    // Delete the clip's R2 object. Local file paths (localFilePath, captionedFilePath)
    // are no longer the source of truth — they were temp working copies cleaned up
    // by the processor's finally block after the job completed.
    if (clip.r2ObjectKey) {
      try {
        await this.r2Service.deleteFile(clip.r2ObjectKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete R2 object ${clip.r2ObjectKey}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await this.jobModel
      .updateOne(
        { _id: jobId },
        { $pull: { clips: { _id: new Types.ObjectId(clipId) } } },
      )
      .exec();

    await this.activitiesService.queueCreate({
      userId: job.userId,
      type: ActivityType.CLIP_DELETE,
      category: ActivityCategory.JOB,
      title: 'Clip deleted',
      description: 'Clip was removed from job.',
      activityUrl: `/dashboard/jobs/${jobId}`,
      entityType: 'clip',
      entityId: clipId,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: { jobId, clipId },
    });

    return { message: 'Clip deleted successfully' };
  }

  // Resume-in-place retry — re-enqueues the SAME job instead of creating a new one.
  // Does NOT deduct a credit (same job, continuing from where it stopped).
  // Only resets terminal error fields; leaves localVideoPath, transcript,
  // highlights, and clips intact so the processor can detect which stages
  // are already complete and skip straight past them.
  //
  // TODO: confirm with product — should a resumed retry consume a credit?
  // Currently it does NOT because it re-uses the same job document.
  async retryJob(userId: string, jobId: string): Promise<{ jobId: string; status: string }> {
    await this.getJobById(userId, jobId); // ownership check + NotFoundException
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.FAILED) {
      throw new ConflictException('Only failed jobs can be retried');
    }

    // Reset only the terminal error fields — DO NOT touch localVideoPath,
    // transcript, highlights, or clips. Those are what the resume logic needs.
    await this.jobModel
      .findByIdAndUpdate(jobId, {
        $set: { status: JobStatus.PENDING },
        $unset: { errorMessage: '', errorStage: '' },
      })
      .exec();

    await this.jobsQueue.add(JOBS_TYPES.CLIP_VIDEO, { jobId });

    return { jobId, status: 'queued_for_retry' };
  }

  // Finds FAILED jobs that have not been updated (i.e. not retried) since the
  // given cutoff date. Used by the TTL sweep cron to delete stale jobDirs.
  async findAbandonedFailedJobs(cutoff: Date): Promise<JobDocument[]> {
    return this.jobModel
      .find({
        status: JobStatus.FAILED,
        updatedAt: { $lt: cutoff },
      })
      .exec();
  }
}
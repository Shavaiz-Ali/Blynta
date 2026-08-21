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

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue(JOBS_QUEUE) private jobsQueue: Queue,
    private usersService: UsersService,
    private configService: ConfigService,
    private r2Service: R2Service,
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
    // For jobs in a terminal state (COMPLETED or FAILED), the local temp directory
    // was already cleaned up at the end of JobsProcessor.processClipVideoJob() via
    // the finally block. Attempting fs.rm here would find nothing and succeed silently
    // (force: true suppresses ENOENT). We still attempt it for the rare edge case where
    // a job reached a terminal state without the finally block running (e.g. process crash).
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

    return { message: 'Clip deleted successfully' };
  }

  // Task 4 — recreate a failed job as a new job (costs a credit — see summary)
  async retryJob(userId: string, jobId: string): Promise<JobDocument> {
    const original = await this.getJobById(userId, jobId);
    if (original.status !== JobStatus.FAILED) {
      throw new ConflictException('Only failed jobs can be retried');
    }

    return this.createJob(userId, {
      sourceUrl: original.sourceUrl,
      sourcePlatform: original.sourcePlatform,
      customPrompt: original.customPrompt,
      aiModel: original.aiModel,
      stylePreset: original.stylePreset,
      resolution: original.resolutionUsed as '720p' | '1080p',
    });
  }
}
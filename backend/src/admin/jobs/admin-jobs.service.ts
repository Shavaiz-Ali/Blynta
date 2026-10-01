import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { ListJobsAdminDto } from '../dto/list-jobs-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';
import { JOBS_QUEUE, JOBS_TYPES } from '../../jobs/jobs.constants';
import { YOUTUBE_PUBLISHING_QUEUE } from '../../youtube/youtube.constants';
import { NOTIFICATIONS_QUEUE } from '../../notifications/notifications.constants';
import { MAIL_QUEUE } from '../../mail/mail.constants';
import { ACTIVITIES_QUEUE } from '../../activities/activities.constants';
import { ActivitiesService } from '../../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../../activities/schemas/activity.schema';

@Injectable()
export class AdminJobsService {
  private readonly logger = new Logger(AdminJobsService.name);

  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue,
    @InjectQueue(YOUTUBE_PUBLISHING_QUEUE) private readonly youtubeQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
    @InjectQueue(ACTIVITIES_QUEUE) private readonly activitiesQueue: Queue,
    private readonly activitiesService: ActivitiesService,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    return new Types.ObjectId(id);
  }

  async listJobs(dto: ListJobsAdminDto): Promise<PaginatedResult<any>> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 25));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (dto.status) {
      filter.status = dto.status;
    }
    if (dto.userId) {
      filter.userId = this.toObjectId(dto.userId);
    }

    if (dto.search && dto.search.trim()) {
      const term = dto.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { videoTitle: regex },
        { videoUploader: regex },
        { sourceUrl: regex },
      ];
    }

    const sortField = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .select('-transcript') // omit huge raw transcript from list overview
        .populate('userId', 'email name plan role')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.jobModel.countDocuments(filter).exec(),
    ]);

    return {
      data: jobs,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getJobDetail(id: string): Promise<any> {
    const jobObjectId = this.toObjectId(id);

    const job = await this.jobModel
      .findById(jobObjectId)
      .populate('userId', 'email name plan role creditsBalance')
      .lean()
      .exec();

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async retryJob(id: string, adminId: string): Promise<any> {
    const jobObjectId = this.toObjectId(id);
    const job = await this.jobModel.findById(jobObjectId).exec();

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    if (job.status !== JobStatus.FAILED) {
      throw new ConflictException('Only failed jobs can be re-triggered');
    }

    // Reset status to PENDING and remove error information
    await this.jobModel
      .findByIdAndUpdate(jobObjectId, {
        $set: { status: JobStatus.PENDING, progressPercent: 0 },
        $unset: { errorMessage: '', errorStage: '' },
      })
      .exec();

    // Re-enqueue in BullMQ
    await this.jobsQueue.add(JOBS_TYPES.CLIP_VIDEO, {
      jobId: job._id.toString(),
      userId: job.userId.toString(),
    });

    // Record admin audit log
    await this.activitiesService.create({
      userId: job.userId,
      actorType: ActivityActorType.ADMIN,
      actorId: this.toObjectId(adminId),
      category: ActivityCategory.JOB,
      type: ActivityType.JOB_CREATE,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.WARNING,
      title: 'Failed Job Retried by Administrator',
      description: `Admin manually re-queued job ${job._id.toString()} (${job.videoTitle || 'Untitled'})`,
      metadata: {
        jobId: job._id.toString(),
        previousError: job.errorMessage,
        errorStage: job.errorStage,
      },
    });

    return {
      success: true,
      jobId: job._id.toString(),
      status: 'queued_for_retry',
      message: 'Job was successfully re-queued for processing.',
    };
  }

  async getJobStats(): Promise<{
    totalJobs: number;
    last24Hours: { total: number; byStatus: Record<string, number> };
    last7Days: { total: number; byStatus: Record<string, number> };
    allTimeByStatus: Record<string, number>;
  }> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalJobs, stats24h, stats7d, statsAllTime] = await Promise.all([
      this.jobModel.countDocuments().exec(),
      this.jobModel.aggregate([
        { $match: { createdAt: { $gte: since24h } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.jobModel.aggregate([
        { $match: { createdAt: { $gte: since7d } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.jobModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const formatByStatus = (agg: Array<{ _id: string; count: number }>) => {
      const result: Record<string, number> = {};
      let sum = 0;
      for (const item of agg) {
        result[item._id] = item.count;
        sum += item.count;
      }
      return { total: sum, byStatus: result };
    };

    const formatted24h = formatByStatus(stats24h);
    const formatted7d = formatByStatus(stats7d);

    const allTimeResult: Record<string, number> = {};
    for (const item of statsAllTime) {
      allTimeResult[item._id] = item.count;
    }

    return {
      totalJobs,
      last24Hours: formatted24h,
      last7Days: formatted7d,
      allTimeByStatus: allTimeResult,
    };
  }

  async getQueueStats(): Promise<any[]> {
    const queueDefs = [
      { queue: this.jobsQueue, name: 'media-processing', label: 'Media Worker Pipeline' },
      { queue: this.youtubeQueue, name: 'youtube-publishing', label: 'YouTube Publisher' },
      { queue: this.notificationsQueue, name: 'notifications', label: 'Notifications Engine' },
      { queue: this.mailQueue, name: 'mail', label: 'Transactional Mail' },
      { queue: this.activitiesQueue, name: 'activities', label: 'Activity & Audit Log' },
    ];

    const results: any[] = [];
    for (const def of queueDefs) {
      try {
        const counts = await def.queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused',
        );
        const isPaused = await def.queue.isPaused().catch(() => false);
        results.push({
          name: def.name,
          label: def.label,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: isPaused,
          isHealthy: true,
        });
      } catch (err) {
        this.logger.warn(`Failed getting queue counts for ${def.name}: ${err}`);
        results.push({
          name: def.name,
          label: def.label,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          isHealthy: false,
        });
      }
    }
    return results;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus, Clip } from './schemas/job.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { JobAccessDeniedException } from '../common/exceptions';
import { UsersService } from '../users/users.service';
import { JOBS_QUEUE, JOBS_TYPES } from './jobs.constants';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue(JOBS_QUEUE) private jobsQueue: Queue,
    private usersService: UsersService,
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

  async getJobsForUser(userId: string): Promise<JobDocument[]> {
    return this.jobModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<JobDocument | null> {
    return this.jobModel
      .findByIdAndUpdate(jobId, updates, { new: true })
      .exec();
  }

  async getClipForDownload(
    userId: string,
    jobId: string,
    clipId: string,
  ): Promise<{ clip: Clip; filePath: string }> {
    const job = await this.getJobById(userId, jobId);
    const clip = job.clips.find((c) => c._id.toString() === clipId);
    if (!clip) throw new NotFoundException('Clip not found');
    const filePath = clip.captionedFilePath || clip.localFilePath;
    if (!filePath) throw new NotFoundException('Clip file not ready');
    return { clip, filePath };
  }
}
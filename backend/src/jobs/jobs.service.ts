import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from './schemas/job.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { JobAccessDeniedException } from '../common/exceptions';

@Injectable()
export class JobsService {
  constructor(@InjectModel(Job.name) private jobModel: Model<JobDocument>) { }

  async createJob(userId: string, dto: CreateJobDto): Promise<JobDocument> {
    const job = new this.jobModel({
      userId: new Types.ObjectId(userId),
      sourceUrl: dto.sourceUrl,
      sourcePlatform: dto.sourcePlatform,
      status: JobStatus.PENDING,
    });
    return job.save();
    // Next step (not yet built): push this job's ID onto a BullMQ queue here
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
}
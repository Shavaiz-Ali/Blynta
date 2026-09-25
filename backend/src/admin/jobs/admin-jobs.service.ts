import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument } from '../../jobs/schemas/job.schema';
import { ListJobsAdminDto } from '../dto/list-jobs-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';

@Injectable()
export class AdminJobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
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
}

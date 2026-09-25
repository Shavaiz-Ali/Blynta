import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Activity,
  ActivityActorType,
  ActivityDocument,
} from '../../activities/schemas/activity.schema';
import { ListAuditAdminDto } from '../dto/list-audit-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    return new Types.ObjectId(id);
  }

  async listAdminAuditLogs(
    dto: ListAuditAdminDto,
  ): Promise<PaginatedResult<any>> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 25));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      actorType: ActivityActorType.ADMIN,
    };

    if (dto.actorId) {
      filter.actorId = this.toObjectId(dto.actorId);
    }
    if (dto.userId) {
      filter.userId = this.toObjectId(dto.userId);
    }
    if (dto.entityType) {
      filter.entityType = dto.entityType;
    }
    if (dto.category) {
      filter.category = dto.category;
    }
    if (dto.type) {
      filter.type = dto.type;
    }

    if (dto.startDate || dto.endDate) {
      filter.createdAt = {};
      if (dto.startDate) {
        filter.createdAt.$gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        filter.createdAt.$lte = new Date(dto.endDate);
      }
    }

    if (dto.search && dto.search.trim()) {
      const term = dto.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const sortField = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder === 'asc' ? 1 : -1;

    const [logs, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .populate('actorId', 'email name role')
        .populate('userId', 'email name role plan')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}

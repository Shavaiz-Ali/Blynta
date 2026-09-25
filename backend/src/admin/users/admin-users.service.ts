import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Customer, CustomerDocument } from '../../billing/schemas/customer.schema';
import { Job, JobDocument } from '../../jobs/schemas/job.schema';
import {
  Activity,
  ActivityActorType,
  ActivityCategory,
  ActivityDocument,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';
import { ListUsersAdminDto } from '../dto/list-users-admin.dto';
import { UpdateUserAdminDto } from '../dto/update-user-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';

const SENSITIVE_FIELDS =
  '-password -refreshTokenHash -otpCode -passwordResetToken -otpExpiresAt -passwordResetExpiresAt';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }
    return new Types.ObjectId(id);
  }

  async listUsers(dto: ListUsersAdminDto): Promise<PaginatedResult<UserDocument>> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 25));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (dto.plan) {
      filter.plan = dto.plan;
    }
    if (dto.role) {
      filter.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      filter.isActive = dto.isActive;
    }

    if (dto.search && dto.search.trim()) {
      const term = dto.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ email: regex }, { name: regex }, { referralCode: regex }];
    }

    const sortField = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(SENSITIVE_FIELDS)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users as unknown as UserDocument[],
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getUserDetail(userId: string): Promise<{
    user: UserDocument;
    customer: CustomerDocument | null;
    recentActivities: ActivityDocument[];
    jobsCount: number;
  }> {
    const userObjectId = this.toObjectId(userId);

    const user = await this.userModel
      .findById(userObjectId)
      .select(SENSITIVE_FIELDS)
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const [customer, recentActivities, jobsCount] = await Promise.all([
      this.customerModel.findOne({ userId: userObjectId }).lean().exec(),
      this.activityModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.jobModel.countDocuments({ userId: userObjectId }).exec(),
    ]);

    return {
      user: user as unknown as UserDocument,
      customer: customer as unknown as CustomerDocument | null,
      recentActivities: recentActivities as unknown as ActivityDocument[],
      jobsCount,
    };
  }

  async updateUser(
    userId: string,
    dto: UpdateUserAdminDto,
    adminId: string,
  ): Promise<UserDocument> {
    const userObjectId = this.toObjectId(userId);
    const adminObjectId = this.toObjectId(adminId);

    const existingUser = await this.userModel.findById(userObjectId).exec();
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updatePayload: Partial<User> = {};
    const changes: Record<string, { before: any; after: any }> = {};

    if (dto.role !== undefined && dto.role !== existingUser.role) {
      changes.role = { before: existingUser.role, after: dto.role };
      updatePayload.role = dto.role;
    }
    if (dto.isActive !== undefined && dto.isActive !== existingUser.isActive) {
      changes.isActive = { before: existingUser.isActive, after: dto.isActive };
      updatePayload.isActive = dto.isActive;
    }
    if (dto.name !== undefined && dto.name !== existingUser.name) {
      changes.name = { before: existingUser.name, after: dto.name };
      updatePayload.name = dto.name;
    }
    if (
      dto.emailVerified !== undefined &&
      dto.emailVerified !== existingUser.emailVerified
    ) {
      changes.emailVerified = {
        before: existingUser.emailVerified,
        after: dto.emailVerified,
      };
      updatePayload.emailVerified = dto.emailVerified;
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userObjectId, { $set: updatePayload }, { new: true })
      .select(SENSITIVE_FIELDS)
      .lean()
      .exec();

    // Log admin activity audit record
    await this.activitiesService.create({
      userId: userObjectId,
      actorType: ActivityActorType.ADMIN,
      actorId: adminObjectId,
      category: ActivityCategory.ACCOUNT,
      type: ActivityType.AUTH_PROFILE_UPDATE,
      title: 'Admin updated user details',
      description: `Reason: ${dto.reason}`,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      entityType: 'user',
      entityId: userObjectId,
      metadata: {
        changes,
        reason: dto.reason,
      },
    });

    return updatedUser as unknown as UserDocument;
  }
}

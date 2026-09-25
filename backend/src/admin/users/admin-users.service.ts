import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole, UserPlan } from '../../users/schemas/user.schema';
import { Customer, CustomerDocument } from '../../billing/schemas/customer.schema';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
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
import { CreateAdminUserDto } from '../dto/create-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';
import { generateReferralCode } from '../../users/utils/generate-referral-code';

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
    // Only list users with role USER by default, unless explicitly querying for another role
    filter.role = dto.role || UserRole.USER;

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

  async createAdminUser(
    dto: CreateAdminUserDto,
    adminId: string,
  ): Promise<UserDocument> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ email }).exec();
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (existing) {
      existing.role = UserRole.ADMIN;
      existing.emailVerified = true;
      existing.isActive = true;
      if (dto.name) existing.name = dto.name;
      existing.password = hashedPassword;
      await existing.save();

      await this.activitiesService.create({
        userId: existing._id,
        actorType: ActivityActorType.ADMIN,
        actorId: this.toObjectId(adminId),
        category: ActivityCategory.ACCOUNT,
        type: ActivityType.AUTH_PROFILE_UPDATE,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.WARNING,
        title: 'User Promoted to Admin',
        description: `User ${email} was promoted to administrator`,
      });

      const sanitized = existing.toObject();
      delete (sanitized as any).password;
      return sanitized as UserDocument;
    }

    let referralCode = generateReferralCode();
    while (await this.userModel.exists({ referralCode })) {
      referralCode = generateReferralCode();
    }

    const newAdmin = await this.userModel.create({
      email,
      password: hashedPassword,
      name: dto.name || 'Admin',
      role: UserRole.ADMIN,
      plan: UserPlan.BUSINESS,
      creditsBalance: 500,
      emailVerified: true,
      isActive: true,
      isWelcomed: true,
      referralCode,
    });

    await this.activitiesService.create({
      userId: newAdmin._id,
      actorType: ActivityActorType.ADMIN,
      actorId: this.toObjectId(adminId),
      category: ActivityCategory.ACCOUNT,
      type: ActivityType.AUTH_REGISTER,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      title: 'Administrator Created',
      description: `New administrator account created for ${email}`,
    });

    const sanitized = newAdmin.toObject();
    delete (sanitized as any).password;
    return sanitized as UserDocument;
  }

  async getUserDetail(id: string): Promise<any> {
    const userObjectId = this.toObjectId(id);

    const user = await this.userModel
      .findById(userObjectId)
      .select(SENSITIVE_FIELDS)
      .populate('referredBy', 'email name')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const [customer, recentJobs, stats] = await Promise.all([
      this.customerModel.findOne({ userId: userObjectId }).lean().exec(),
      this.jobModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.calculateUserStats(userObjectId),
    ]);

    return {
      user,
      customer: customer ?? null,
      recentJobs: recentJobs ?? [],
      stats,
    };
  }

  private async calculateUserStats(userId: Types.ObjectId): Promise<any> {
    const [totalJobs, completedJobs, failedJobs, totalEvents] =
      await Promise.all([
        this.jobModel.countDocuments({ userId }).exec(),
        this.jobModel.countDocuments({ userId, status: JobStatus.COMPLETED }).exec(),
        this.jobModel.countDocuments({ userId, status: JobStatus.FAILED }).exec(),
        this.activityModel.countDocuments({ userId }).exec(),
      ]);

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      totalEvents,
    };
  }

  async updateUser(
    id: string,
    dto: UpdateUserAdminDto,
    adminId: string,
  ): Promise<UserDocument> {
    const userObjectId = this.toObjectId(id);

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const changes: Record<string, { before: any; after: any }> = {};

    if (dto.role !== undefined && dto.role !== user.role) {
      changes.role = { before: user.role, after: dto.role };
      user.role = dto.role;
    }

    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      changes.isActive = { before: user.isActive, after: dto.isActive };
      user.isActive = dto.isActive;
    }

    if (
      dto.emailVerified !== undefined &&
      dto.emailVerified !== user.emailVerified
    ) {
      changes.emailVerified = {
        before: user.emailVerified,
        after: dto.emailVerified,
      };
      user.emailVerified = dto.emailVerified;
    }

    if (dto.name !== undefined && dto.name !== user.name) {
      changes.name = { before: user.name, after: dto.name };
      user.name = dto.name;
    }

    if (Object.keys(changes).length === 0) {
      return user;
    }

    await user.save();

    await this.activitiesService.create({
      userId: user._id,
      actorType: ActivityActorType.ADMIN,
      actorId: this.toObjectId(adminId),
      category: ActivityCategory.ACCOUNT,
      type: ActivityType.AUTH_PROFILE_UPDATE,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.WARNING,
      title: 'User Profile Updated by Admin',
      description: `Admin updated user ${user.email} (${Object.keys(changes).join(', ')})`,
      metadata: {
        reason: dto.reason,
        changes,
      },
    });

    const updated = await this.userModel
      .findById(userObjectId)
      .select(SENSITIVE_FIELDS)
      .lean()
      .exec();

    return updated as unknown as UserDocument;
  }
}

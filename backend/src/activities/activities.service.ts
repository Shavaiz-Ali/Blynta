import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';

import {
  Activity,
  ActivityActorType,
  ActivityCategory,
  ActivityDocument,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from './schemas/activity.schema';
import {
  ACTIVITIES_QUEUE,
  ACTIVITY_JOBS,
} from './activities.constants';

type ObjectIdLike = string | Types.ObjectId;

export interface CreateActivityInput {
  userId: ObjectIdLike;
  category: ActivityCategory;
  type: ActivityType;
  title: string;
  description?: string;
  activityUrl?: string;
  status?: ActivityStatus;
  severity?: ActivitySeverity;
  actorType?: ActivityActorType;
  actorId?: ObjectIdLike;
  entityType?: string;
  entityId?: ObjectIdLike;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  ipAddress?: string;
  userAgent?: string;
  isSystem?: boolean;
}

export interface ListActivitiesOptions {
  page?: number;
  limit?: number;
  category?: ActivityCategory;
  type?: ActivityType;
  status?: ActivityStatus;
}

export interface ListActivitiesResult {
  activities: ActivityDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 50;

  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectQueue(ACTIVITIES_QUEUE)
    private readonly activitiesQueue: Queue,
  ) {}

  private toObjectId(value: ObjectIdLike): Types.ObjectId {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ID');
    }

    return new Types.ObjectId(value);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }

  async create(input: CreateActivityInput): Promise<ActivityDocument> {
    const userId = this.toObjectId(input.userId);
    const actorId = input.actorId ? this.toObjectId(input.actorId) : undefined;
    const entityId = input.entityId ? this.toObjectId(input.entityId) : undefined;

    const activity = new this.activityModel({
      userId,
      category: input.category,
      type: input.type,
      title: input.title,
      description: input.description,
      activityUrl: input.activityUrl,
      status: input.status ?? ActivityStatus.SUCCESS,
      severity: input.severity ?? ActivitySeverity.INFO,
      actorType: input.actorType ?? (input.isSystem ? ActivityActorType.SYSTEM : ActivityActorType.USER),
      actorId,
      entityType: input.entityType,
      entityId,
      metadata: input.metadata,
      dedupeKey: input.dedupeKey,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      isSystem: input.isSystem ?? false,
    });

    try {
      return await activity.save();
    } catch (error) {
      if (input.dedupeKey && this.isDuplicateKeyError(error)) {
        const existing = await this.activityModel
          .findOne({ dedupeKey: input.dedupeKey })
          .exec();

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  async createIfNotExists(input: CreateActivityInput): Promise<ActivityDocument> {
    if (!input.dedupeKey) {
      throw new BadRequestException('dedupeKey is required when using createIfNotExists');
    }

    return this.create(input);
  }

  /**
   * Enqueue activity creation asynchronously to avoid blocking the primary business flow.
   * Isolates failures so activity tracking never crashes user operations.
   */
  async queueCreate(input: CreateActivityInput): Promise<void> {
    try {
      // Normalize ObjectIds to strings for clean JSON serialization in BullMQ
      const payload = {
        ...input,
        userId: input.userId.toString(),
        actorId: input.actorId ? input.actorId.toString() : undefined,
        entityId: input.entityId ? input.entityId.toString() : undefined,
      };

      await this.activitiesQueue.add(ACTIVITY_JOBS.CREATE, payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue activity [${input.type}] for user ${input.userId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Enqueue activity creation with deduplication guarantee.
   */
  async queueCreateIfNotExists(input: CreateActivityInput): Promise<void> {
    if (!input.dedupeKey) {
      throw new BadRequestException('dedupeKey is required when using queueCreateIfNotExists');
    }

    try {
      const payload = {
        ...input,
        userId: input.userId.toString(),
        actorId: input.actorId ? input.actorId.toString() : undefined,
        entityId: input.entityId ? input.entityId.toString() : undefined,
      };

      await this.activitiesQueue.add(ACTIVITY_JOBS.CREATE_IF_NOT_EXISTS, payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue deduplicated activity [${input.type}] with key ${input.dedupeKey}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async listForUser(
    userId: string,
    options: ListActivitiesOptions = {},
  ): Promise<ListActivitiesResult> {
    const userObjectId = this.toObjectId(userId);

    const page = Math.max(this.DEFAULT_PAGE, options.page ?? this.DEFAULT_PAGE);
    const requestedLimit = options.limit ?? this.DEFAULT_LIMIT;
    const limit = Math.min(Math.max(1, requestedLimit), this.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      userId: userObjectId,
      ...(options.category && { category: options.category }),
      ...(options.type && { type: options.type }),
      ...(options.status && { status: options.status }),
    };

    const [activities, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);

    return {
      activities,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }
}

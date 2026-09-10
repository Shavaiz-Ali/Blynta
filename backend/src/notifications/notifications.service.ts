import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as mongoose from 'mongoose';
import {
  Model,
  Types,
} from 'mongoose';

import {
  Notification,
  NotificationCategory,
  NotificationDocument,
  NotificationStatus,
  NotificationType,
} from './schemas/notification.schema';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOBS,
} from './notifications.constants';

type ObjectIdLike = string | Types.ObjectId;

export interface CreateNotificationInput {
  userId: ObjectIdLike;

  type: NotificationType;

  category: NotificationCategory;

  title: string;

  message: string;

  actionUrl?: string;

  actionLabel?: string;

  entityType?: string;

  entityId?: ObjectIdLike;

  metadata?: Record<string, unknown>;

  /**
   * Optional unique identifier for logically identical
   * notifications.
   *
   * Example:
   *
   * job:665abc:completed
   *
   * If omitted, the notification is not deduplicated.
   */
  dedupeKey?: string;
}

export interface ListNotificationsOptions {
  page?: number;

  limit?: number;

  status?: NotificationStatus;

  category?: NotificationCategory;
}

export interface ListNotificationsResult {
  notifications: NotificationDocument[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}

@Injectable()
export class NotificationsService {
  private readonly DEFAULT_PAGE = 1;

  private readonly DEFAULT_LIMIT = 20;

  private readonly MAX_LIMIT = 50;

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Convert a string/ObjectId into a valid MongoDB ObjectId.
   *
   * We validate strings here so invalid IDs do not result
   * in unexpected Mongoose CastErrors.
   */
  private toObjectId(value: ObjectIdLike): Types.ObjectId {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ID');
    }

    return new Types.ObjectId(value);
  }

  /**
   * Create a notification.
   *
   * This method does not perform deduplication unless a
   * dedupeKey is supplied.
   */
  async create(
    input: CreateNotificationInput,
  ): Promise<NotificationDocument> {
    const userId = this.toObjectId(input.userId);

    const entityId = input.entityId
      ? this.toObjectId(input.entityId)
      : undefined;

    const notification = new this.notificationModel({
      userId,

      type: input.type,

      category: input.category,

      title: input.title,

      message: input.message,

      actionUrl: input.actionUrl,

      actionLabel: input.actionLabel,

      entityType: input.entityType,

      entityId,

      metadata: input.metadata,

      dedupeKey: input.dedupeKey,

      status: NotificationStatus.UNREAD,
    });

    try {
      return await notification.save();
    } catch (error) {
      /**
       * MongoDB duplicate key error.
       *
       * This normally means another worker created the
       * same deduplicated notification first.
       */
      if (
        input.dedupeKey &&
        this.isDuplicateKeyError(error)
      ) {
        const existing =
          await this.notificationModel
            .findOne({
              dedupeKey: input.dedupeKey,
            })
            .exec();

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  /**
   * Create a notification only if the logical notification
   * does not already exist.
   *
   * IMPORTANT:
   * The dedupeKey must be provided for this method.
   *
   * MongoDB's unique index provides the actual concurrency
   * protection.
   */
  async createIfNotExists(
    input: CreateNotificationInput,
  ): Promise<NotificationDocument> {
    if (!input.dedupeKey) {
      throw new BadRequestException(
        'dedupeKey is required when using createIfNotExists',
      );
    }

    return this.create(input);
  }

  /**
   * Queue a notification creation job.
   *
   * This method adds a job to the BullMQ queue instead of
   * writing directly to the database.
   */
  async queueCreate(
    input: CreateNotificationInput,
  ): Promise<void> {
    await this.notificationsQueue.add(
      NOTIFICATION_JOBS.CREATE,
      input,
    );
  }

  /**
   * Queue a notification creation job only if it does not
   * already exist (requires dedupeKey).
   *
   * This method adds a job to the BullMQ queue instead of
   * writing directly to the database.
   */
  async queueCreateIfNotExists(
    input: CreateNotificationInput,
  ): Promise<void> {
    if (!input.dedupeKey) {
      throw new BadRequestException(
        'dedupeKey is required when using queueCreateIfNotExists',
      );
    }

    await this.notificationsQueue.add(
      NOTIFICATION_JOBS.CREATE_IF_NOT_EXISTS,
      input,
    );
  }

  /**
   * List notifications belonging to a specific user.
   */
  async listForUser(
    userId: string,
    options: ListNotificationsOptions = {},
  ): Promise<ListNotificationsResult> {
    const userObjectId = this.toObjectId(userId);

    const page = Math.max(
      this.DEFAULT_PAGE,
      options.page ?? this.DEFAULT_PAGE,
    );

    const requestedLimit =
      options.limit ?? this.DEFAULT_LIMIT;

    const limit = Math.min(
      Math.max(1, requestedLimit),
      this.MAX_LIMIT,
    );

    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<NotificationDocument> = {
      userId: userObjectId,
    };

    if (options.status) {
      filter.status = options.status;
    }

    if (options.category) {
      filter.category = options.category;
    }

    const [
      notifications,
      total,
    ] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .exec(),

      this.notificationModel
        .countDocuments(filter)
        .exec(),
    ]);

    return {
      notifications,

      total,

      page,

      limit,

      totalPages:
        total === 0
          ? 0
          : Math.ceil(total / limit),
    };
  }

  /**
   * Get the number of unread notifications belonging
   * to a specific user.
   */
  async getUnreadCount(
    userId: string,
  ): Promise<number> {
    const userObjectId = this.toObjectId(userId);

    return this.notificationModel
      .countDocuments({
        userId: userObjectId,

        status: NotificationStatus.UNREAD,
      })
      .exec();
  }

  /**
   * Mark one notification as read.
   *
   * The notification MUST belong to the authenticated user.
   */
  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDocument> {
    const userObjectId = this.toObjectId(userId);

    const notificationObjectId =
      this.toObjectId(notificationId);

    const notification =
      await this.notificationModel
        .findOne({
          _id: notificationObjectId,

          userId: userObjectId,
        })
        .exec();

    if (!notification) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    /**
     * Idempotent operation.
     *
     * If it is already read, simply return it.
     */
    if (
      notification.status ===
      NotificationStatus.READ
    ) {
      return notification;
    }

    notification.status =
      NotificationStatus.READ;

    notification.readAt = new Date();

    return notification.save();
  }

  /**
   * Mark every unread notification belonging to the
   * authenticated user as read.
   */
  async markAllAsRead(
    userId: string,
  ): Promise<{ updatedCount: number }> {
    const userObjectId = this.toObjectId(userId);

    const result =
      await this.notificationModel
        .updateMany(
          {
            userId: userObjectId,

            status: NotificationStatus.UNREAD,
          },
          {
            $set: {
              status: NotificationStatus.READ,

              readAt: new Date(),
            },
          },
        )
        .exec();

    return {
      updatedCount: result.modifiedCount,
    };
  }

  /**
   * Delete a notification belonging to the authenticated user.
   */
  async deleteForUser(
    userId: string,
    notificationId: string,
  ): Promise<{ message: string }> {
    const userObjectId = this.toObjectId(userId);

    const notificationObjectId =
      this.toObjectId(notificationId);

    const deleted =
      await this.notificationModel
        .findOneAndDelete({
          _id: notificationObjectId,

          userId: userObjectId,
        })
        .exec();

    if (!deleted) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    return {
      message:
        'Notification deleted successfully',
    };
  }

  /**
   * Detect MongoDB duplicate-key errors.
   */
  private isDuplicateKeyError(
    error: unknown,
  ): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      code?: unknown;
    };

    return candidate.code === 11000;
  }
}
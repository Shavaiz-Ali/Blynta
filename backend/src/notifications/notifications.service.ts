import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';

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

  private toObjectId(value: ObjectIdLike): Types.ObjectId {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ID');
    }

    return new Types.ObjectId(value);
  }

  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
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
      if (input.dedupeKey && this.isDuplicateKeyError(error)) {
        const existing = await this.notificationModel
          .findOne({ dedupeKey: input.dedupeKey })
          .exec();

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

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

  async queueCreate(input: CreateNotificationInput): Promise<void> {
    await this.notificationsQueue.add(
      NOTIFICATION_JOBS.CREATE,
      input,
    );
  }

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

  async listForUser(
    userId: string,
    options: ListNotificationsOptions = {},
  ): Promise<ListNotificationsResult> {
    const userObjectId = this.toObjectId(userId);

    const page = Math.max(
      this.DEFAULT_PAGE,
      options.page ?? this.DEFAULT_PAGE,
    );

    const requestedLimit = options.limit ?? this.DEFAULT_LIMIT;
    const limit = Math.min(
      Math.max(1, requestedLimit),
      this.MAX_LIMIT,
    );

    const skip = (page - 1) * limit;

    const filter = {
      userId: userObjectId,
      ...(options.status && { status: options.status }),
      ...(options.category && { category: options.category }),
    };

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const userObjectId = this.toObjectId(userId);

    return this.notificationModel
      .countDocuments({
        userId: userObjectId,
        status: NotificationStatus.UNREAD,
      })
      .exec();
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDocument> {
    const userObjectId = this.toObjectId(userId);
    const notificationObjectId = this.toObjectId(notificationId);

    const notification = await this.notificationModel
      .findOne({
        _id: notificationObjectId,
        userId: userObjectId,
      })
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status === NotificationStatus.READ) {
      return notification;
    }

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();

    return notification.save();
  }

  async markAllAsRead(
    userId: string,
  ): Promise<{ updatedCount: number }> {
    const userObjectId = this.toObjectId(userId);

    const result = await this.notificationModel
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

  async deleteForUser(
    userId: string,
    notificationId: string,
  ): Promise<{ message: string }> {
    const userObjectId = this.toObjectId(userId);
    const notificationObjectId = this.toObjectId(notificationId);

    const deleted = await this.notificationModel
      .findOneAndDelete({
        _id: notificationObjectId,
        userId: userObjectId,
      })
      .exec();

    if (!deleted) {
      throw new NotFoundException('Notification not found');
    }

    return {
      message: 'Notification deleted successfully',
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      code?: unknown;
    };

    return candidate.code === 11000;
  }
}
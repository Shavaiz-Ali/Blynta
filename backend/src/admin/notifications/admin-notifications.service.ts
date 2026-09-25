import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOBS,
} from '../../notifications/notifications.constants';
import {
  NotificationCategory,
} from '../../notifications/schemas/notification.schema';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async broadcast(
    dto: BroadcastNotificationDto,
    adminId: string,
  ): Promise<{ queuedCount: number; filter?: any }> {
    const filterQuery: Record<string, any> = { isActive: true };

    if (dto.filter?.plan) {
      filterQuery.plan = dto.filter.plan;
    }
    if (dto.filter?.role) {
      filterQuery.role = dto.filter.role;
    }

    const recipients = await this.userModel
      .find(filterQuery)
      .select('_id')
      .lean()
      .exec();

    const jobs = recipients.map((u) => ({
      name: NOTIFICATION_JOBS.CREATE,
      data: {
        userId: u._id.toString(),
        type: dto.type,
        category: NotificationCategory.SYSTEM,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl,
      },
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }));

    if (jobs.length > 0) {
      // Chunk bulk add in batches of 500 to keep Redis payloads fast and lightweight
      const chunkSize = 500;
      for (let i = 0; i < jobs.length; i += chunkSize) {
        const chunk = jobs.slice(i, i + chunkSize);
        await this.notificationsQueue.addBulk(chunk);
      }
    }

    this.logger.log(
      `Broadcast notification queued for ${recipients.length} users by admin ${adminId}`,
    );

    // Audit log
    const adminObjectId = Types.ObjectId.isValid(adminId)
      ? new Types.ObjectId(adminId)
      : undefined;

    if (adminObjectId) {
      await this.activitiesService.create({
        userId: adminObjectId,
        actorType: ActivityActorType.ADMIN,
        actorId: adminObjectId,
        category: ActivityCategory.SYSTEM,
        type: ActivityType.SYSTEM_EVENT,
        title: `Broadcast notification: "${dto.title}"`,
        description: `Sent to ${recipients.length} recipients. Reason: ${dto.reason || 'General announcement'}`,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.INFO,
        metadata: {
          title: dto.title,
          filter: dto.filter,
          recipientCount: recipients.length,
          reason: dto.reason,
        },
      });
    }

    return {
      queuedCount: recipients.length,
      filter: dto.filter,
    };
  }
}

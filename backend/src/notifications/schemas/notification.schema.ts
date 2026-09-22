import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationCategory {
  SYSTEM = 'system',
  JOB = 'job',
  BILLING = 'billing',
  CREDIT = 'credit',
  REFERRAL = 'referral',
  ACCOUNT = 'account',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  })
  type: NotificationType;

  @Prop({
    type: String,
    enum: Object.values(NotificationCategory),
    required: true,
    index: true,
  })
  category: NotificationCategory;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  })
  message: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationChannel),
    required: true,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    required: true,
    default: NotificationStatus.UNREAD,
    index: true,
  })
  status: NotificationStatus;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
  })
  actionUrl?: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 100,
  })
  actionLabel?: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 100,
  })
  entityType?: string;

  @Prop({
    type: Types.ObjectId,
  })
  entityId?: Types.ObjectId;

  @Prop({
    type: Object,
    default: undefined,
  })
  metadata?: Record<string, unknown>;

  /**
   * Used to guarantee that the same logical notification
   * cannot be created more than once.
   *
   * Example:
   * job:665abc:completed
   */
  @Prop({
    type: String,
    trim: true,
    maxlength: 300,
    sparse: true,
  })
  dedupeKey?: string;

  @Prop({
    type: Date,
    index: true,
  })
  readAt?: Date;

  @Prop({
    type: Date,
  })
  expiresAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

/**
 * Main notification listing:
 *
 * userId + status + createdAt
 */
NotificationSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

/**
 * All notifications for a user:
 *
 * userId + createdAt
 */
NotificationSchema.index({
  userId: 1,
  createdAt: -1,
});

/**
 * Expiration lookup.
 */
NotificationSchema.index({
  expiresAt: 1,
});

/**
 * Guarantees that a notification with the same
 * dedupeKey cannot be inserted twice.
 *
 * `sparse: true` means notifications without a
 * dedupeKey are allowed to coexist normally.
 */
NotificationSchema.index(
  {
    dedupeKey: 1,
  },
  {
    unique: true,
    sparse: true,
    name: 'notifications_dedupe_key_unique',
  },
);

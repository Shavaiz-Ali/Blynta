import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

export enum ActivityCategory {
  AUTH = 'auth',
  JOB = 'job',
  BILLING = 'billing',
  CREDIT = 'credit',
  REFERRAL = 'referral',
  ACCOUNT = 'account',
  SYSTEM = 'system',
}

export enum ActivityType {
  // Authentication & Session
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_REGISTER = 'auth.register',
  AUTH_PASSWORD_CHANGE = 'auth.password_change',
  AUTH_PASSWORD_RESET_REQUEST = 'auth.password_reset_request',
  AUTH_PASSWORD_RESET_COMPLETE = 'auth.password_reset_complete',
  AUTH_ACCOUNT_LINK = 'auth.account_link',
  AUTH_ACCOUNT_UNLINK = 'auth.account_unlink',
  AUTH_PROFILE_UPDATE = 'auth.profile_update',
  AUTH_AVATAR_UPDATE = 'auth.avatar_update',

  // Jobs & Media Processing
  JOB_CREATE = 'job.create',
  JOB_START = 'job.start',
  JOB_COMPLETE = 'job.complete',
  JOB_FAIL = 'job.fail',
  JOB_CANCEL = 'job.cancel',
  JOB_DELETE = 'job.delete',
  CLIP_DOWNLOAD = 'clip.download',
  CLIP_EXPORT = 'clip.export',
  CLIP_DELETE = 'clip.delete',

  // Billing & Subscriptions
  BILLING_SUBSCRIPTION_CREATE = 'billing.subscription_create',
  BILLING_SUBSCRIPTION_UPDATE = 'billing.subscription_update',
  BILLING_SUBSCRIPTION_CANCEL = 'billing.subscription_cancel',
  BILLING_PAYMENT_SUCCESS = 'billing.payment_success',
  BILLING_PAYMENT_FAILED = 'billing.payment_failed',
  BILLING_INVOICE_PAID = 'billing.invoice_paid',

  // Credits
  CREDIT_PURCHASE = 'credit.purchase',
  CREDIT_DEDUCT = 'credit.deduct',
  CREDIT_RESET = 'credit.reset',
  CREDIT_REFUND = 'credit.refund',
  CREDIT_BONUS = 'credit.bonus',

  // Referrals
  REFERRAL_INVITE_SENT = 'referral.invite_sent',
  REFERRAL_SIGNUP = 'referral.signup',
  REFERRAL_REWARD_EARNED = 'referral.reward_earned',

  // System & Administration
  SYSTEM_EVENT = 'system.event',
  API_ACCESS = 'system.api_access',
}

export enum ActivityStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

export enum ActivitySeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum ActivityActorType {
  USER = 'user',
  SYSTEM = 'system',
  ADMIN = 'admin',
  WORKER = 'worker',
}

@Schema({
  timestamps: true,
  collection: 'activities',
})
export class Activity {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ActivityCategory),
    required: true,
    index: true,
  })
  category: ActivityCategory;

  @Prop({
    type: String,
    enum: Object.values(ActivityType),
    required: true,
    index: true,
  })
  type: ActivityType;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 1000,
  })
  description?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
  })
  activityUrl?: string;

  @Prop({
    type: String,
    enum: Object.values(ActivityStatus),
    required: true,
    default: ActivityStatus.SUCCESS,
    index: true,
  })
  status: ActivityStatus;

  @Prop({
    type: String,
    enum: Object.values(ActivitySeverity),
    required: true,
    default: ActivitySeverity.INFO,
  })
  severity: ActivitySeverity;

  @Prop({
    type: String,
    enum: Object.values(ActivityActorType),
    required: true,
    default: ActivityActorType.USER,
  })
  actorType: ActivityActorType;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: false,
  })
  actorId?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  })
  entityType?: string;

  @Prop({
    type: Types.ObjectId,
    required: false,
  })
  entityId?: Types.ObjectId;

  @Prop({
    type: Object,
    required: false,
    default: undefined,
  })
  metadata?: Record<string, unknown>;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 300,
    sparse: true,
  })
  dedupeKey?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 45,
  })
  ipAddress?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
  })
  userAgent?: string;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isSystem: boolean;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

/**
 * Primary user activity timeline:
 * userId + createdAt (newest first)
 */
ActivitySchema.index({
  userId: 1,
  createdAt: -1,
});

/**
 * Filtered user activity feed by category:
 * userId + category + createdAt
 */
ActivitySchema.index({
  userId: 1,
  category: 1,
  createdAt: -1,
});

/**
 * Filtered user activity feed by specific action type:
 * userId + type + createdAt
 */
ActivitySchema.index({
  userId: 1,
  type: 1,
  createdAt: -1,
});

/**
 * Filtered user activity feed by status:
 * userId + status + createdAt
 */
ActivitySchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

/**
 * Audit trail lookup for specific entities (e.g. all activities for a job or invoice):
 * entityType + entityId + createdAt
 */
ActivitySchema.index({
  entityType: 1,
  entityId: 1,
  createdAt: -1,
});

/**
 * Global timeline for admin overview / audit reporting:
 * createdAt (newest first)
 */
ActivitySchema.index({
  createdAt: -1,
});

/**
 * Deduplication unique sparse index:
 * Prevents identical activities on webhook retries or processor retries
 */
ActivitySchema.index(
  {
    dedupeKey: 1,
  },
  {
    unique: true,
    sparse: true,
    name: 'activities_dedupe_key_unique',
  },
);

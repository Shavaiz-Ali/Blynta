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

  JOB_CREATE = 'job.create',
  JOB_START = 'job.start',
  JOB_COMPLETE = 'job.complete',
  JOB_FAIL = 'job.fail',
  JOB_CANCEL = 'job.cancel',
  JOB_DELETE = 'job.delete',
  CLIP_DOWNLOAD = 'clip.download',
  CLIP_EXPORT = 'clip.export',
  CLIP_DELETE = 'clip.delete',

  BILLING_SUBSCRIPTION_CREATE = 'billing.subscription_create',
  BILLING_SUBSCRIPTION_UPDATE = 'billing.subscription_update',
  BILLING_SUBSCRIPTION_CANCEL = 'billing.subscription_cancel',
  BILLING_PAYMENT_SUCCESS = 'billing.payment_success',
  BILLING_PAYMENT_FAILED = 'billing.payment_failed',
  BILLING_INVOICE_PAID = 'billing.invoice_paid',

  CREDIT_PURCHASE = 'credit.purchase',
  CREDIT_DEDUCT = 'credit.deduct',
  CREDIT_RESET = 'credit.reset',
  CREDIT_REFUND = 'credit.refund',
  CREDIT_BONUS = 'credit.bonus',

  REFERRAL_INVITE_SENT = 'referral.invite_sent',
  REFERRAL_SIGNUP = 'referral.signup',
  REFERRAL_REWARD_EARNED = 'referral.reward_earned',

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

export interface Activity {
  _id: string;
  userId: string;
  category: ActivityCategory;
  type: ActivityType;
  title: string;
  description?: string;
  activityUrl?: string;
  status: ActivityStatus;
  severity: ActivitySeverity;
  actorType: ActivityActorType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  ipAddress?: string;
  userAgent?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListActivitiesResult {
  activities: Activity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityStats {
  total: number;
  jobsCount: number;
  jobsCompleted: number;
  creditsUsed: number;
  billingEvents: number;
}

export interface ListActivitiesOptions {
  page?: number;
  limit?: number;
  category?: ActivityCategory;
  type?: ActivityType;
  status?: ActivityStatus;
  search?: string;
}

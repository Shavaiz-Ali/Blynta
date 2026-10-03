export enum NotificationType {
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error",
}

export enum NotificationCategory {
  SYSTEM = "system",
  JOB = "job",
  BILLING = "billing",
  CREDIT = "credit",
  REFERRAL = "referral",
  ACCOUNT = "account",
}

export enum NotificationStatus {
  UNREAD = "unread",
  READ = "read",
}

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  status: NotificationStatus;
  actionUrl?: string;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationsResult {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
  category?: NotificationCategory;
}

export interface UnreadCountResult {
  count: number;
}

export interface MarkAllAsReadResult {
  updatedCount: number;
}

export interface DeleteNotificationResult {
  message: string;
}

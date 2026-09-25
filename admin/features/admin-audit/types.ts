export type AuditLogAction =
  | "user.update"
  | "user.ban"
  | "user.unban"
  | "user.role_change"
  | "job.delete"
  | "billing.override"
  | string;

export interface AdminAuditLogItem {
  _id: string;
  adminId: string;
  adminEmail?: string;
  action: AuditLogAction;
  targetType?: string;
  targetId?: string;
  reason: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ListAuditParams {
  page?: number;
  limit?: number;
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedAuditResponse {
  data: AdminAuditLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditActor {
  _id?: string;
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
}

export interface AdminAuditLogItem {
  _id: string;
  userId: string | AuditActor;
  actorId?: string | AuditActor;
  actorType: string;
  category: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  severity: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ListAuditParams {
  page?: number;
  limit?: number;
  search?: string;
  actorId?: string;
  userId?: string;
  entityType?: string;
  category?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
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

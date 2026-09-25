export type SubStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "paused"
  | "unknown";

export interface AdminCustomerItem {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  plan: string;
  paddleCustomerId: string;
  paddleSubscriptionId?: string;
  paddleSubscriptionStatus?: SubStatus;
  paddlePriceId?: string;
  paddleProductId?: string;
  paddleScheduledChangeAction?: string | null;
  paddleScheduledChangeAt?: string | null;
  currentBillingPeriodEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: SubStatus;
}

export interface PaginatedCustomersResponse {
  data: AdminCustomerItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminSubscriptionEvent {
  _id: string;
  userId: string;
  userEmail?: string;
  eventType: string;
  paddleEventId?: string;
  plan?: string;
  status?: string;
  creditsDelta?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ListEventsParams {
  page?: number;
  limit?: number;
  userId?: string;
  eventType?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedEventsResponse {
  data: AdminSubscriptionEvent[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

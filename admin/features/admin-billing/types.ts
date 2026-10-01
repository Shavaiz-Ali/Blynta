export type SubStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "paused"
  | "unknown";

export interface AdminCustomerUser {
  _id: string;
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
  creditsBalance?: number;
}

export interface AdminCustomerItem {
  _id: string;
  userId: string | AdminCustomerUser;
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

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "pro" | "business";

export interface AdminUserItem {
  _id: string;
  id?: string;
  email: string;
  name?: string;
  role: UserRole;
  plan: UserPlan;
  isActive: boolean;
  emailVerified: boolean;
  creditsBalance: number;
  totalCreditsUsed: number;
  referralCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  plan?: UserPlan;
  role?: UserRole;
  isActive?: boolean;
}

export interface PaginatedUsersResponse {
  data: AdminUserItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserDetailResponse {
  user: AdminUserItem;
  customer: {
    paddleCustomerId: string;
    paddleSubscriptionId?: string;
    paddleSubscriptionStatus?: string;
    paddleScheduledChangeAction?: string | null;
    currentBillingPeriodEndsAt?: string;
  } | null;
  recentJobs?: Array<{
    _id: string;
    videoTitle?: string;
    sourceUrl?: string;
    sourcePlatform?: string;
    status: string;
    createdAt: string;
    clips?: Array<unknown>;
  }>;
  stats?: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalEvents: number;
  };
  recentActivities?: Array<{
    _id: string;
    title: string;
    description?: string;
    category: string;
    type: string;
    status: string;
    severity: string;
    actorType: string;
    createdAt: string;
  }>;
  jobsCount?: number;
}

export interface UpdateUserPayload {
  role?: UserRole;
  isActive?: boolean;
  name?: string;
  emailVerified?: boolean;
  reason: string;
}

export interface CreateAdminPayload {
  email: string;
  password: string;
  name?: string;
}

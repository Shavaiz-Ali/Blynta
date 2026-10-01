import { axiosClient } from "@/config/axiosClient";

export interface QueueMetric {
  name: string;
  label: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  isHealthy: boolean;
}

export interface DashboardStats {
  range: DashboardRange;
  users: {
    total: number;
    active: number;
    newThisWeek: number;
    freeCount: number;
    proCount: number;
    businessCount: number;
    paidCount: number;
  };
  jobs: {
    total: number;
    completedToday: number;
    failedToday: number;
    pending: number;
    processing: number;
    successRate: number;
  };
  clips: {
    total: number;
    generatedToday: number;
    generatedInPeriod: number;
  };
  billing: {
    activeSubscriptions: number;
    mrr: number; // cents
    pastDue: number;
    freeUsers: number;
    proUsers: number;
    businessUsers: number;
  };
  comparisons: {
    newUsersInPeriod: number;
    jobsInPeriod: number;
    clipsInPeriod: number;
    userGrowthRate: number;
    jobGrowthRate: number;
    clipGrowthRate: number;
  };
  userGrowthSeries: Array<{
    date: string;
    newUsers: number;
  }>;
  jobActivitySeries: Array<{
    date: string;
    completed: number;
    failed: number;
    total: number;
  }>;
  clipActivitySeries: Array<{
    date: string;
    generated: number;
  }>;
  jobStatusDistribution: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  queueHealth: QueueMetric[];
  recentAudit: Array<{
    _id: string;
    adminEmail?: string;
    adminName?: string;
    actorType?: string;
    category?: string;
    action: string;
    title?: string;
    reason: string;
    severity?: string;
    status?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}

export type DashboardRange = "7d" | "30d" | "90d";

export const adminDashboardApi = {
  getStats: async (range: DashboardRange = "30d"): Promise<DashboardStats> => {
    const { data } = await axiosClient.get<DashboardStats>("/admin/dashboard", {
      params: { range },
    });
    return data;
  },
};

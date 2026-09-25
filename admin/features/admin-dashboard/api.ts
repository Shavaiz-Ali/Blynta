import { axiosClient } from "@/config/axiosClient";

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
  };
  jobs: {
    total: number;
    completedToday: number;
    failedToday: number;
    pending: number;
  };
  billing: {
    activeSubscriptions: number;
    mrr: number;
    pastDue: number;
  };
  recentAudit: Array<{
    _id: string;
    adminEmail?: string;
    action: string;
    reason: string;
    createdAt: string;
  }>;
}

export const adminDashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await axiosClient.get<DashboardStats>("/admin/dashboard");
    return data;
  },
};

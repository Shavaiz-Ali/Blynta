import { adminDashboardApi } from "@/features/admin-dashboard/api";
import type { AnalyticsQuery, AnalyticsResult } from "./types";
export const analyticsMetrics = { newUsers: "New users", completed: "Completed jobs", failed: "Failed jobs" } as const;
export const analyticsService = {
  async query(query: AnalyticsQuery): Promise<AnalyticsResult> {
    if (query.comparison || Object.keys(query.filters || {}).length) throw new Error("Comparison periods and custom filters are not supported by the analytics API.");
    const data = await adminDashboardApi.getStats();
    const points = query.metric === "newUsers" ? data.userGrowthSeries.map(p => ({ date: p.date, value: p.newUsers })) : data.jobActivitySeries.map(p => ({ date: p.date, value: p[query.metric as "completed" | "failed"] }));
    return { points, comparisonAvailable: false };
  },
};

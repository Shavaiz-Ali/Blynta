import { useQuery } from "@tanstack/react-query";
import { adminDashboardApi } from "./api";

export const dashboardKeys = {
  stats: ["admin-dashboard", "stats"] as const,
};

export function useDashboardStatsQuery() {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: adminDashboardApi.getStats,
    staleTime: 60_000, // 1 min — stats don't need to be real-time
    refetchInterval: 120_000,
  });
}

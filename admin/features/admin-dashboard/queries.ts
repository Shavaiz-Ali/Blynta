import { useQuery } from "@tanstack/react-query";
import { adminDashboardApi, type DashboardRange } from "./api";

export const dashboardKeys = {
  all: ["admin-dashboard"] as const,
  stats: (range: DashboardRange) => [...dashboardKeys.all, "stats", range] as const,
};

export function useDashboardStatsQuery(range: DashboardRange = "30d") {
  return useQuery({
    queryKey: dashboardKeys.stats(range),
    queryFn: () => adminDashboardApi.getStats(range),
    placeholderData: (previousData) => previousData,
    staleTime: 60_000, // 1 min — stats don't need to be real-time
    refetchInterval: 120_000,
  });
}

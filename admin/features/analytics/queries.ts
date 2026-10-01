import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "./service";
import type { AnalyticsQuery } from "./types";
export const analyticsKeys = { all: ["admin-analytics"] as const, query: (query: AnalyticsQuery) => ["admin-analytics", query] as const };
export function useAnalytics(query: AnalyticsQuery) { return useQuery({ queryKey: analyticsKeys.query(query), queryFn: () => analyticsService.query(query), staleTime: 60_000 }); }

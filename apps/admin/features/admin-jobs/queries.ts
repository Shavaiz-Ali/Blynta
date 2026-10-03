import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminJobsApi } from "./api";
import { ListJobsParams } from "./types";
import { toast } from "sonner";
import { dashboardKeys } from "../admin-dashboard/queries";
import { getErrorMessage } from "@/lib/errors";

export const adminJobsKeys = {
  all: ["admin-jobs"] as const,
  lists: () => [...adminJobsKeys.all, "list"] as const,
  list: (params?: ListJobsParams) =>
    [...adminJobsKeys.lists(), params] as const,
  details: () => [...adminJobsKeys.all, "detail"] as const,
  detail: (id: string) => [...adminJobsKeys.details(), id] as const,
  stats: () => [...adminJobsKeys.all, "stats"] as const,
  queues: () => [...adminJobsKeys.all, "queues"] as const,
};

export function useAdminJobsQuery(params?: ListJobsParams) {
  return useQuery({
    queryKey: adminJobsKeys.list(params),
    queryFn: () => adminJobsApi.listJobs(params),
    staleTime: 10_000,
  });
}

export function useAdminJobDetailQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: adminJobsKeys.detail(id),
    queryFn: () => adminJobsApi.getJobDetail(id),
    enabled: Boolean(id) && enabled,
    staleTime: 5_000,
  });
}

export function useAdminJobStatsQuery() {
  return useQuery({
    queryKey: adminJobsKeys.stats(),
    queryFn: adminJobsApi.getJobStats,
    staleTime: 30_000,
  });
}

export function useAdminQueuesQuery() {
  return useQuery({
    queryKey: adminJobsKeys.queues(),
    queryFn: adminJobsApi.getQueues,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useRetryJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminJobsApi.retryJob(id),
    onSuccess: (data, id) => {
      toast.success(data.message || "Job re-queued for processing");
      queryClient.invalidateQueries({ queryKey: adminJobsKeys.all });
      queryClient.invalidateQueries({ queryKey: adminJobsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to retry job"));
    },
  });
}

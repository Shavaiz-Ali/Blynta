import { useQuery } from "@tanstack/react-query";
import { adminJobsApi } from "./api";
import { ListJobsParams } from "./types";

export const adminJobKeys = {
  all: ["admin-jobs"] as const,
  lists: () => [...adminJobKeys.all, "list"] as const,
  list: (params?: ListJobsParams) => [...adminJobKeys.lists(), params] as const,
};

export function useAdminJobsQuery(params?: ListJobsParams) {
  return useQuery({
    queryKey: adminJobKeys.list(params),
    queryFn: () => adminJobsApi.listJobs(params),
  });
}

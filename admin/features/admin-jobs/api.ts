import { axiosClient } from "@/config/axiosClient";
import {
  AdminJobItem,
  JobStatsResponse,
  ListJobsParams,
  PaginatedJobsResponse,
  QueueStatusItem,
} from "./types";

export const adminJobsApi = {
  listJobs: async (params?: ListJobsParams): Promise<PaginatedJobsResponse> => {
    const { data } = await axiosClient.get<PaginatedJobsResponse>("/admin/jobs", { params });
    return data;
  },

  getJobDetail: async (id: string): Promise<AdminJobItem> => {
    const { data } = await axiosClient.get<AdminJobItem>(`/admin/jobs/${id}`);
    return data;
  },

  getJobStats: async (): Promise<JobStatsResponse> => {
    const { data } = await axiosClient.get<JobStatsResponse>("/admin/jobs/stats");
    return data;
  },

  getQueues: async (): Promise<QueueStatusItem[]> => {
    const { data } = await axiosClient.get<QueueStatusItem[]>("/admin/jobs/queues");
    return data;
  },

  retryJob: async (id: string): Promise<{ success: boolean; jobId: string; status: string; message: string }> => {
    const { data } = await axiosClient.post<{ success: boolean; jobId: string; status: string; message: string }>(
      `/admin/jobs/${id}/retry`
    );
    return data;
  },
};

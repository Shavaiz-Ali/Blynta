import { axiosClient } from "@/config/axiosClient";
import { ListJobsParams, PaginatedJobsResponse } from "./types";

export const adminJobsApi = {
  listJobs: async (params?: ListJobsParams): Promise<PaginatedJobsResponse> => {
    const { data } = await axiosClient.get<PaginatedJobsResponse>("/admin/jobs", { params });
    return data;
  },
};

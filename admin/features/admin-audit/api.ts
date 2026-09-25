import { axiosClient } from "@/config/axiosClient";
import { ListAuditParams, PaginatedAuditResponse } from "./types";

export const adminAuditApi = {
  listLogs: async (params?: ListAuditParams): Promise<PaginatedAuditResponse> => {
    const { data } = await axiosClient.get<PaginatedAuditResponse>("/admin/audit", { params });
    return data;
  },
};

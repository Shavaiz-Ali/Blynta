import { useQuery } from "@tanstack/react-query";
import { adminAuditApi } from "./api";
import { ListAuditParams } from "./types";

export const adminAuditKeys = {
  all: ["admin-audit"] as const,
  lists: () => [...adminAuditKeys.all, "list"] as const,
  list: (params?: ListAuditParams) => [...adminAuditKeys.lists(), params] as const,
};

export function useAdminAuditQuery(params?: ListAuditParams) {
  return useQuery({
    queryKey: adminAuditKeys.list(params),
    queryFn: () => adminAuditApi.listLogs(params),
  });
}

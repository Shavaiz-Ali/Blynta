import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { adminAuthApi } from "./api";

export const adminAuthKeys = {
  all: ["admin-auth"] as const,
  me: () => [...adminAuthKeys.all, "me"] as const,
};

export function useCurrentAdminQuery() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: adminAuthKeys.me(),
    queryFn: () => adminAuthApi.getMe(),
    enabled: status === "authenticated" && !!session?.user,
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

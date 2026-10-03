"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { accountRequest } from "@/config/axiosClient";
export function useEnabledProviders() {
  return useQuery({
    queryKey: ["auth", "providers"],
    queryFn: () => accountRequest<string[]>("providers"),
    retry: false,
    staleTime: 60000,
  });
}
export function useAccountMutation(action: string) {
  return useMutation({
    mutationFn: (body: Record<string, string>) =>
      accountRequest<{ email?: string; message?: string }>(action, body),
  });
}

"use client";
import { productFetch } from "@blynta/auth/client";
import { useSession } from "@blynta/auth/react";
import { useQuery } from "@tanstack/react-query";

export interface AccountProfile {
  name?: string;
  avatarUrl?: string;
  plan: string;
  creditsBalance: number;
  creditsReserved?: number;
  creditsResetAt?: string;
}
export interface AccountNotification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  status: "read" | "unread";
  actionUrl?: string;
  actionLabel?: string;
}
export interface NotificationPage {
  notifications: AccountNotification[];
  totalPages: number;
}
export async function workspaceRequest<T>(
  path: string,
  method = "GET",
): Promise<T> {
  const response = await productFetch(`/api/workspace/${path}`, { method });
  const json = await response.json();
  if (!response.ok || !json.success)
    throw new Error(json.error?.message || "Could not load account data.");
  return json.data as T;
}
export function useWorkspaceQuery<T>(path: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["workspace", session?.user.id, path],
    queryFn: () => workspaceRequest<T>(path),
    enabled: !!session?.user.id,
    staleTime: 30000,
    refetchInterval: 15000,
  });
}

"use client";
import { useSession } from "next-auth/react";
import {
  productFetch,
  redirectProductSessionLoss,
  productSessionState,
} from "@blynta/auth/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { AppButton } from "@blynta/ui";
export function ProtectedStudio({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const phase = useSyncExternalStore(
    productSessionState.subscribe,
    productSessionState.getSnapshot,
    () => "active",
  );
  const check = useQuery({
    queryKey: ["auth", "profile", session?.user.id],
    enabled: status === "authenticated",
    retry: false,
    refetchInterval: 60000,
    queryFn: async () => {
      const response = await productFetch("/api/session-check");
      if (response.status === 401) {
        throw Object.assign(
          new Error("Your session expired. Please sign in again."),
          { status: 401 },
        );
      }
      if (!response.ok)
        throw new Error(
          "Unable to verify your account. Check your connection and retry.",
        );
      return true;
    },
  });
  useEffect(() => {
    if (status === "unauthenticated") redirectProductSessionLoss();
  }, [status]);
  if (phase !== "active") return children;
  if (status !== "authenticated" || check.isPending) return <LoadingSkeleton />;
  if (check.isError)
    return (
      <main className="p-10">
        <h1>We couldn’t open Studio</h1>
        <p className="my-4 text-muted-foreground">{check.error.message}</p>
        <AppButton onClick={() => check.refetch()}>Try again</AppButton>
      </main>
    );
  return children;
}

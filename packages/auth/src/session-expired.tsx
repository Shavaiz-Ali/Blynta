"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionContext, useSession } from "next-auth/react";
import { AppButton, AppDialog } from "@blynta/ui";
import {
  expireProductSession,
  productSessionState,
  startProductReauthentication,
} from "./client";

export function SessionExpiredDialog() {
  const { status } = useSession();
  const phase = useSyncExternalStore(
    productSessionState.subscribe,
    productSessionState.getSnapshot,
    () => "active",
  );
  useEffect(() => {
    // Mounted only after the protected server layout validated a product session.
    if (status === "unauthenticated") expireProductSession();
  }, [status]);
  return (
    <AppDialog
      open={phase !== "active"}
      onOpenChange={() => {}}
      dismissible={false}
      showCloseButton={false}
      title="Your session has expired"
      description="Sign in again to continue using Blynta."
    >
      <AppButton
        className="w-full"
        onClick={startProductReauthentication}
        disabled={phase === "authorizing"}
      >
        {phase === "authorizing" ? "Opening sign-in…" : "Sign in again"}
      </AppButton>
    </AppDialog>
  );
}

/** Preserve rendered context and query keys while the outer provider detects loss.
 * This snapshot grants no API access: both product transports check live expiration.
 */
export function ProductSessionBoundary({
  initialSession,
  children,
}: {
  initialSession: Session;
  children: ReactNode;
}) {
  const current = useSession();
  const phase = useSyncExternalStore(
    productSessionState.subscribe,
    productSessionState.getSnapshot,
    () => "active",
  );
  const data =
    phase === "active" && current.status === "authenticated"
      ? current.data
      : initialSession;
  return (
    <>
      <SessionContext.Provider
        value={{ data, status: "authenticated", update: current.update }}
      >
        {children}
      </SessionContext.Provider>
      <SessionExpiredDialog />
    </>
  );
}

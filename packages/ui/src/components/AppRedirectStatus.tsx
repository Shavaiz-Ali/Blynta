"use client";

import { CircleCheck } from "lucide-react";
import { AppSpinner } from "./AppSpinner";

/** Shared success feedback while authentication navigation completes. */
export function AppRedirectStatus({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-5 py-2 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <CircleCheck className="size-8 text-primary" aria-hidden="true" />
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <AppSpinner size="sm" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

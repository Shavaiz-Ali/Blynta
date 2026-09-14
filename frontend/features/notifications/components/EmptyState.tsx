"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { InboxIcon } from "./icons";

/* -------------------------------------------------------------------------- */
/*                                EmptyState                                  */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps {
  compact?: boolean;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  compact,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col items-center justify-center text-center my-auto",
        compact ? "px-4 py-6 gap-1.5" : "px-4 py-16 gap-3"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-muted/60 border border-border/70 text-muted-foreground",
          compact ? "h-10 w-10 mb-0.5" : "h-14 w-14 mb-2"
        )}
      >
        <InboxIcon
          className={cn(
            compact ? "h-4.5 w-4.5" : "h-6 w-6",
            "text-muted-foreground"
          )}
        />
      </div>
      <div className="space-y-0.5">
        <p
          className={cn(
            compact ? "text-xs font-semibold" : "text-base font-semibold",
            "text-foreground"
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            compact ? "text-[11px] max-w-[220px]" : "text-sm max-w-[360px]",
            "text-muted-foreground leading-relaxed"
          )}
        >
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

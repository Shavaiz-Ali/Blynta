"use client";

import * as React from "react";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { CrownIcon } from "../icons";
import { cn } from "@/lib/utils";

export function UpgradeBanner({ plan }: { plan: UserProfile["plan"] }) {
  const [dismissed, setDismissed] = React.useState(false);

  if (plan !== "free" || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-border/70 bg-card/60 text-xs">
      <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
        <CrownIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <span className="truncate">
          Free plan active —{" "}
          <Link href="/billing" className="text-foreground font-semibold hover:text-primary transition-colors">
            upgrade
          </Link>{" "}
          for HD exports, no watermark, and 10× more credits.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

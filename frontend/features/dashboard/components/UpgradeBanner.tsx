"use client";

import * as React from "react";
import Link from "next/link";
import { AppButton } from "@/components/common/AppButton";
import type { UserProfile } from "@/features/auth/types";
import { CrownIcon } from "../icons";

export function UpgradeBanner({ plan }: { plan: UserProfile["plan"] }) {
  if (plan !== "free") return null;

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border/80 bg-card/80 backdrop-blur text-xs text-muted-foreground shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <CrownIcon className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate">
          You are using the{" "}
          <strong className="text-foreground font-semibold">Free Plan</strong>{" "}
          with watermark &amp; standard features.
        </span>
      </div>
      <Link href="/billing" className="shrink-0 sm:w-auto w-full">
        <AppButton size="sm" className="h-7.5 text-xs px-3.5 font-semibold w-full sm:w-auto">
          Upgrade
        </AppButton>
      </Link>
    </div>
  );
}

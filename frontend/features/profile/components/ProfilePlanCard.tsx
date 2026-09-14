"use client";

import * as React from "react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AppButton } from "@/components/common/AppButton";
import { cn } from "@/lib/utils";
import { ZapIcon } from "@/features/dashboard/icons";
import type { UserProfile } from "@/features/auth/types";

interface Props {
  profile: UserProfile;
}

function formatResetDate(dateStr?: string | null): string {
  if (!dateStr) return "Next billing cycle";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Next billing cycle";
  }
}

export function ProfilePlanCard({ profile }: Props) {
  const planLabel = (profile.plan ?? "free").toLowerCase();
  const isPro = planLabel === "pro" || planLabel === "business";
  const credits = profile.creditsBalance ?? 0;
  const maxCredits = planLabel === "business" ? 200 : isPro ? 50 : 5;
  const usedPercent = Math.min(100, Math.round(((maxCredits - credits) / maxCredits) * 100));
  const remainPercent = 100 - usedPercent;

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10">
            <ZapIcon className="h-4 w-4 text-primary fill-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Plan &amp; Credits</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Subscription tier and generation credits</p>
          </div>
        </div>
        <Link href="/billing">
          <AppButton
            size="sm"
            variant={isPro ? "outline" : "default"}
            icon={<ZapIcon className="h-3 w-3" />}
            className="h-8 text-xs font-semibold shrink-0"
          >
            {isPro ? "Manage" : "Upgrade"}
          </AppButton>
        </Link>
      </div>

      <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Active Tier */}
        <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Active Tier</p>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "text-[11px] px-2 h-5 font-bold uppercase tracking-wider",
                isPro
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-foreground border border-border/50"
              )}
            >
              {planLabel}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isPro ? "Active subscription" : "Free creator tier"}
          </p>
        </div>

        {/* Credits */}
        <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Credits</p>
            <span className="text-xs font-bold text-foreground tabular-nums">{credits} / {maxCredits}</span>
          </div>
          <Progress value={remainPercent} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">{usedPercent}% of period used</p>
        </div>

        {/* Reset Date */}
        <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Resets On</p>
          <p className="text-sm font-bold text-foreground">{formatResetDate(profile.creditsResetAt)}</p>
          <p className="text-[11px] text-muted-foreground">Quota refreshes automatically</p>
        </div>
      </div>
    </div>
  );
}

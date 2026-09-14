import * as React from "react";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ZapIcon } from "../icons";
import { UserDropdown } from "./UserDropdown";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

export function DashboardHeaderRight({ profile }: { profile: UserProfile }) {
  const credits = profile.creditsBalance ?? 0;
  const planLabel = profile.plan ?? "free";
  const isPro = planLabel === "pro" || planLabel === "business";

  // Rough max credits by plan for the usage bar
  const maxCredits = planLabel === "business" ? 200 : isPro ? 50 : 5;
  const usedPercent = Math.min(100, Math.round(((maxCredits - credits) / maxCredits) * 100));

  return (
    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      {/* Credits Popover */}
      <Popover>
        <PopoverTrigger
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border/80 hover:border-primary/40 text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer"
          title="View credit balance"
        >
          <ZapIcon className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
          <span className="tabular-nums font-bold">{credits}</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline font-normal">
            credits
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-64 p-4 rounded-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Credit Balance</p>
              <Badge
                variant="secondary"
                className="text-[10px] h-5 px-1.5 font-bold uppercase tracking-wider"
              >
                {planLabel}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-bold text-foreground tabular-nums">
                  {credits} / {maxCredits}
                </span>
              </div>
              <Progress value={100 - usedPercent} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                {usedPercent}% used this period
              </p>
            </div>
            <Separator />
            <Link
              href="/billing"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-2 hover:bg-primary/90 transition-colors"
            >
              <ZapIcon className="h-3 w-3 fill-current" />
              {isPro ? "Manage Plan" : "Upgrade for more"}
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      {/* Notifications */}
      <NotificationBell />

      <UserDropdown profile={profile} />
    </div>
  );
}

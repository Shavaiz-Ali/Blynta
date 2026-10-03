import * as React from "react";
import type { UserProfile } from "@/features/auth/types";
import { cn } from "@/lib/utils";
import { CoinsIcon, FilmIcon, CrownIcon } from "../icons";

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: string;
  className?: string;
}

function StatItem({ icon, label, value, accent, className }: StatItemProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          accent ?? "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase leading-none tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-bold leading-none text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

interface StatsBarProps {
  profile: UserProfile | undefined;
  totalClips: number;
  creditsResetText: string;
}

export function StatsBar({
  profile,
  totalClips,
  creditsResetText,
}: StatsBarProps) {
  const planLabel =
    profile?.plan === "free"
      ? "Free"
      : profile?.plan
        ? `${profile.plan[0].toUpperCase()}${profile.plan.slice(1)}`
        : "Free";

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-3 sm:gap-0">
      <StatItem
        icon={<CoinsIcon className="h-4 w-4" />}
        label="Credits"
        value={
          <>
            <span>{profile?.creditsBalance ?? 0}</span>
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              {creditsResetText}
            </span>
          </>
        }
        accent="bg-secondary/15 text-secondary-foreground"
      />
      <StatItem
        icon={<FilmIcon className="h-4 w-4" />}
        label="Clips generated"
        value={totalClips}
        accent="bg-chart-1/15 text-chart-1"
        className="border-border/60 sm:border-l sm:pl-5"
      />
      <StatItem
        icon={<CrownIcon className="h-4 w-4" />}
        label="Plan"
        value={planLabel}
        accent="bg-primary/15 text-primary"
        className="border-border/60 sm:border-l sm:pl-5"
      />
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-3 sm:gap-0">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2.5",
            i > 0 && "border-border/60 sm:border-l sm:pl-5",
          )}
        >
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-1">
            <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

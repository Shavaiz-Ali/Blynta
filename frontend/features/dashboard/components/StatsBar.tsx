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
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          accent ?? "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-foreground leading-none truncate">
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

export function StatsBar({ profile, totalClips, creditsResetText }: StatsBarProps) {
  const planLabel = profile?.plan === "free"
    ? "Free"
    : profile?.plan
      ? `${profile.plan[0].toUpperCase()}${profile.plan.slice(1)}`
      : "Free";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 rounded-xl border border-border/60 bg-muted/20">
      <StatItem
        icon={<CoinsIcon className="h-4 w-4" />}
        label="Credits"
        value={
          <>
            <span>{profile?.creditsBalance ?? 0}</span>
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              · {creditsResetText}
            </span>
          </>
        }
        accent="bg-secondary/15 text-secondary-foreground"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<FilmIcon className="h-4 w-4" />}
        label="Clips generated"
        value={totalClips}
        accent="bg-chart-1/15 text-chart-1"
      />

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      <StatItem
        icon={<CrownIcon className="h-4 w-4" />}
        label="Plan"
        value={planLabel}
        accent="bg-primary/15 text-primary"
      />
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="flex items-center gap-6 px-4 py-3 rounded-xl border border-border/60 bg-muted/20">
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1">
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-10 rounded bg-muted animate-pulse" />
            </div>
          </div>
          {i < 2 && <div className="h-6 w-px bg-border/60 hidden sm:block" />}
        </React.Fragment>
      ))}
    </div>
  );
}

import * as React from "react";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { AppButton } from "@/components/common/AppButton";
import { BellIcon, ZapIcon } from "../icons";
import { UserDropdown } from "./UserDropdown";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export function DashboardHeaderRight({ profile }: { profile: UserProfile }) {
  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      {/* Credits Badge */}
      <Link
        href="/billing"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-xs font-semibold text-foreground transition-colors shadow-2xs"
        title="Credits Balance"
      >
        <ZapIcon className="h-3.5 w-3.5 text-primary fill-primary" />
        <span className="tabular-nums font-bold text-foreground">
          {profile.creditsBalance ?? 0}
        </span>
        <span className="text-[11px] text-muted-foreground hidden sm:inline font-normal">
          credits
        </span>
      </Link>

      <ThemeToggle />

      <AppButton
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 rounded-xl bg-muted/60 border border-border/70 hover:bg-muted"
        aria-label="Notifications"
      >
        <BellIcon className="h-4 w-4 text-muted-foreground" />
        <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-chart-5 ring-2 ring-card" />
      </AppButton>

      <UserDropdown profile={profile} />
    </div>
  );
}


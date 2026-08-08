import * as React from "react";
import type { UserProfile } from "@/features/auth/types";
import { BellIcon } from "../icons";
import { UserDropdown } from "./UserDropdown";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export function DashboardHeaderRight({ profile }: { profile: UserProfile }) {
  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <ThemeToggle />

      <button
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 border border-border/70 hover:bg-muted transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <BellIcon className="h-4 w-4 text-muted-foreground" />
        <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-chart-5 ring-2 ring-card" />
      </button>

      <UserDropdown profile={profile} />
    </div>
  );
}

import * as React from "react";
import type { UserProfile } from "@/features/auth/types";
import { AppButton } from "@/components/common/AppButton";
import { BellIcon } from "../icons";
import { UserDropdown } from "./UserDropdown";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export function DashboardHeaderRight({ profile }: { profile: UserProfile }) {
  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
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

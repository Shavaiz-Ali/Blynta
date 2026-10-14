"use client";

import { usePathname } from "next/navigation";
import { AppProductHeader } from "@blynta/ui";
import type { UserProfile } from "@/features/auth/types";
import { AppHeaderRight } from "./AppHeaderRight";
import { getAppRoute } from "./routes";

export function AppHeader({
  profile,
  profileError,
  ...sidebar
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onMenu: () => void;
  profile?: UserProfile;
  profileError: boolean;
}) {
  const { title } = getAppRoute(usePathname());
  return (
    <AppProductHeader {...sidebar} sidebarId="app-sidebar">
      <div data-app-header className="flex w-full min-w-0 items-center gap-2">
        <h1
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          title={title}
        >
          {title}
        </h1>
        <AppHeaderRight profile={profile} profileError={profileError} />
      </div>
    </AppProductHeader>
  );
}

"use client";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { AppHeaderActions, AppCreditsControl } from "@blynta/ui";
import { UserDropdown } from "./UserDropdown";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
export function DashboardHeaderRight({ profile }: { profile: UserProfile }) {
  const plan = profile.plan ?? "free";
  const allowance = plan === "business" ? 200 : plan === "pro" ? 50 : 5;
  return (
    <AppHeaderActions
      credits={
        <AppCreditsControl
          balance={profile.creditsBalance}
          plan={plan}
          allowance={allowance}
          billingLink={<Link href="/billing" />}
        />
      }
      notifications={<NotificationBell />}
      account={<UserDropdown profile={profile} />}
    />
  );
}

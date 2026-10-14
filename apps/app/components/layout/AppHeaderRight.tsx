"use client";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { AppHeaderActions, AppCreditsControl } from "@blynta/ui";
import { UserDropdown } from "@/features/dashboard/components/UserDropdown";
import { useSession } from "@blynta/auth/react";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
export function AppHeaderRight({
  profile,
  profileError,
}: {
  profile?: UserProfile;
  profileError: boolean;
}) {
  const { data: session } = useSession();
  const plan = profile?.plan ?? "free";
  const allowance = plan === "business" ? 200 : plan === "pro" ? 50 : 5;
  return (
    <AppHeaderActions
      credits={
        <AppCreditsControl
          balance={profile?.creditsBalance}
          reserved={profile?.creditsReserved}
          resetAt={profile?.creditsResetAt}
          plan={profile?.plan}
          allowance={profile ? allowance : undefined}
          error={
            profileError && !profile
              ? "Account credits could not be loaded."
              : undefined
          }
          billingLink={<Link href="/billing" />}
        />
      }
      notifications={<NotificationBell />}
      account={
        <UserDropdown
          profile={profile ?? session?.user ?? { name: "Account" }}
        />
      }
    />
  );
}

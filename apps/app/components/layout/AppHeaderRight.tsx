"use client";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { AppHeaderActions, AppCreditsControl } from "@blynta/ui";
import { UserDropdown } from "@/features/dashboard/components/UserDropdown";
import { useSession } from "@blynta/auth/react";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useCreditBalance } from "@/features/billing/queries";
export function AppHeaderRight({
  profile,
  profileError,
}: {
  profile?: UserProfile;
  profileError: boolean;
}) {
  const { data: session } = useSession();
  const credits = useCreditBalance();
  const allowance = profile
    ? credits.data?.planAllocations?.[profile.plan]
    : undefined;
  return (
    <AppHeaderActions
      credits={
        <AppCreditsControl
          balance={credits.data?.available ?? profile?.creditsBalance}
          reserved={credits.data?.reserved ?? profile?.creditsReserved}
          resetAt={credits.data?.nextRenewal ?? undefined}
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

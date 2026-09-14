"use client";

import * as React from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppSpinner } from "@/components/common/AppSpinner";
import { useCurrentUser } from "@/features/auth";
import { UserIcon } from "@/features/dashboard/icons";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { ProfilePlanCard } from "./ProfilePlanCard";
import { ProfileConnectedAccountsCard } from "./ProfileConnectedAccountsCard";
import { ProfileSecurityCard } from "./ProfileSecurityCard";
import { ProfileReferralCard } from "./ProfileReferralCard";

/* ───────────────────────────────────────────────────────────
   Danger Zone  (self-contained, no extra logic needed)
─────────────────────────────────────────────────────────── */
function DangerZone() {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            Permanently delete your workspace, generated clips, transcripts, and all account data. This action is irreversible.
          </p>
        </div>
        <div className="flex items-center gap-2 opacity-40 cursor-not-allowed select-none shrink-0">
          <button
            disabled
            className="h-8 px-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs font-semibold pointer-events-none"
          >
            Delete Account
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            Soon
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Loading skeleton
─────────────────────────────────────────────────────────── */
function ProfileSkeleton() {
  return (
    <div className="space-y-4 pb-16 animate-pulse">
      <div className="rounded-xl border border-border/80 bg-card h-40" />
      <div className="rounded-xl border border-border/80 bg-card h-36" />
      <div className="rounded-xl border border-border/80 bg-card h-44" />
      <div className="rounded-xl border border-border/80 bg-card h-32" />
      <div className="rounded-xl border border-border/80 bg-card h-64" />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Main page
─────────────────────────────────────────────────────────── */
export function ProfilePage() {
  const { data: profile, isLoading } = useCurrentUser();

  const headerContent = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">Profile &amp; Account</h1>
      </div>
      {profile && <DashboardHeaderRight profile={profile} />}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      {isLoading ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <div className="flex items-center justify-center h-40">
          <AppSpinner size="md" />
        </div>
      ) : (
        <div className="space-y-4 pb-16">
          {/* Page heading */}
          <div className="space-y-0.5 pb-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Account &amp; Profile</h1>
            <p className="text-xs text-muted-foreground">
              Manage your identity, security, subscription, and referral rewards.
            </p>
          </div>

          {/* ① Identity */}
          <ProfileIdentityCard profile={profile} />

          {/* ② Plan & Credits */}
          <ProfilePlanCard profile={profile} />

          {/* ③ Connected Accounts */}
          <ProfileConnectedAccountsCard profile={profile} />

          {/* ④ Security */}
          <ProfileSecurityCard profile={profile} />

          {/* ⑤ Referrals */}
          <ProfileReferralCard />

          {/* ⑥ Danger Zone */}
          <DangerZone />
        </div>
      )}
    </DashboardLayout>
  );
}

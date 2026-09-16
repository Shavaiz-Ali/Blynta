"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/auth/queries";
import { useJobs } from "@/features/jobs";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { WelcomeDialog } from "@/features/dashboard/components/WelcomeDialog";
import { AppButton } from "@/components/common/AppButton";
import { DashboardHeaderRight } from "./DashboardHeaderRight";
import { UpgradeBanner } from "./UpgradeBanner";
import { HeroInput } from "./HeroInput";
import { ActivePipelineBanner } from "./ActivePipelineBanner";
import { JobsCard } from "./JobsCard";
import { JobsSkeleton } from "./JobsSkeleton";
import { AttentionNeeded } from "./AttentionNeeded";
import { AlertTriangleIcon } from "../icons";

export function DashboardHome() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useCurrentUser();
  const {
    data: jobsResult,
    isLoading: jobsLoading,
    error: jobsError,
  } = useJobs();
  const jobs = jobsResult?.jobs ?? [];

  const [showWelcome, setShowWelcome] = React.useState(false);

  React.useEffect(() => {
    if (profile && profile.isWelcomed === false) {
      setShowWelcome(true);
    }
  }, [profile?.isWelcomed]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      <h1 className="text-sm font-medium text-foreground">Home</h1>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* ── Top Upgrade Short Banner (if on free tier) ── */}
      {!profileLoading && <UpgradeBanner plan={profile?.plan ?? "free"} />}

      {/* ── High-Impact Hero & Smart Input ── */}
      <HeroInput />

      {/* ── Active Real-time Pipeline Progress Banner ── */}
      {!jobsLoading && <ActivePipelineBanner jobs={jobs} />}

      {/* ── Attention needed (failed jobs banner if any) ── */}
      {!jobsLoading && <AttentionNeeded jobs={jobs} />}

      {/* ── Recent Projects / Clips Section ── */}
      <div className="min-w-0">
        {jobsLoading ? (
          <JobsSkeleton />
        ) : jobsError ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm text-center">
            <AlertTriangleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load your clips
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(jobsError as any)?.message ||
                "Please refresh the page to try again."}
            </p>
            <AppButton
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.refresh()}
            >
              Refresh
            </AppButton>
          </div>
        ) : (
          <JobsCard jobs={jobs} />
        )}
      </div>

      {profile ? (
        <WelcomeDialog
          open={showWelcome}
          onOpenChange={setShowWelcome}
          creditsBalance={profile.creditsBalance ?? 0}
        />
      ) : null}
    </DashboardLayout>
  );
}

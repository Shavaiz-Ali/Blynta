"use client";

import * as React from "react";
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
import { AttentionNeeded } from "./AttentionNeeded";
import { AlertTriangleIcon } from "../icons";
import { StatsBar, StatsBarSkeleton } from "./StatsBar";

export function DashboardHome() {
  const { data: profile, isLoading: profileLoading } = useCurrentUser();
  const {
    data: jobsResult,
    isLoading: jobsLoading,
    error: jobsError,
    refetch,
    isFetching,
  } = useJobs();
  const jobs = React.useMemo(() => jobsResult?.jobs ?? [], [jobsResult?.jobs]);
  const totalClips = React.useMemo(
    () => jobs.reduce((total, job) => total + (job.clips?.length ?? 0), 0),
    [jobs]
  );
  const firstName = profile?.name?.split(" ")[0] || "there";

  const [welcomeDismissed, setWelcomeDismissed] = React.useState(false);
  const showWelcome = profile?.isWelcomed === false && !welcomeDismissed;

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

      <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Creator workspace</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Turn a long video into polished shorts, then review and schedule them from one workspace.
          </p>
        </div>
        <div className="w-full lg:max-w-xl">
          {profileLoading || jobsLoading ? (
            <StatsBarSkeleton />
          ) : (
            <StatsBar profile={profile} totalClips={totalClips} creditsResetText="available" />
          )}
        </div>
      </section>

      {/* ── High-Impact Hero & Smart Input ── */}
      <HeroInput />

      {/* ── Active Real-time Pipeline Progress Banner ── */}
      {!jobsLoading && <ActivePipelineBanner jobs={jobs} />}

      {/* ── Attention needed (failed jobs banner if any) ── */}
      {!jobsLoading && <AttentionNeeded jobs={jobs} />}

      {/* ── Recent Projects / Clips Section ── */}
      <div className="min-w-0">
        {jobsError ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm text-center">
            <AlertTriangleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load your clips
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {jobsError.message ||
                "Please refresh the page to try again."}
            </p>
            <AppButton
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Retrying..." : "Try again"}
            </AppButton>
          </div>
        ) : (
          <JobsCard jobs={jobs} isLoading={jobsLoading} />
        )}
      </div>

      {profile ? (
        <WelcomeDialog
          open={showWelcome}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setWelcomeDismissed(true);
          }}
          creditsBalance={profile.creditsBalance ?? 0}
        />
      ) : null}
    </DashboardLayout>
  );
}

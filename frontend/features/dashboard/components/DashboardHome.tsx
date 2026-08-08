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
import { StatsBar, StatsBarSkeleton } from "./StatsBar";
import { JobsCard } from "./JobsCard";
import { JobsSkeleton } from "./JobsSkeleton";
import { AttentionNeeded } from "./AttentionNeeded";
import { AlertTriangleIcon } from "../icons";
import { getFirstName, countCompletedClips } from "../utils";

export function DashboardHome() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useCurrentUser();
  const {
    data: jobs = [],
    isLoading: jobsLoading,
    error: jobsError,
  } = useJobs();

  const [showWelcome, setShowWelcome] = React.useState(false);

  React.useEffect(() => {
    if (profile && profile.isWelcomed === false) {
      setShowWelcome(true);
    }
  }, [profile?.isWelcomed]);

  const creditsResetText = profile?.creditsResetAt
    ? `Resets ${new Date(profile.creditsResetAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`
    : "Resets monthly";

  const totalClipsGenerated = countCompletedClips(jobs);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center">
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {/* ── Top Upgrade Short Banner (Opus Clip style) ── */}
        {!profileLoading && <UpgradeBanner plan={profile?.plan ?? "free"} />}

        {/* ── Page heading ── */}
        <div>
          {profileLoading ? (
            <div className="space-y-1.5">
              <div className="h-8 w-56 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
            </div>
          ) : profile ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Welcome back, {getFirstName(profile.name || profile.email)}
                <span className="text-primary">.</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste a video link or upload a file to generate viral clips automatically.
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Dashboard
            </h1>
          )}
        </div>

        {/* ── Hero input (primary action) ── */}
        <HeroInput />

        {/* ── Slim stats bar (secondary info) ── */}
        {profileLoading || jobsLoading ? (
          <StatsBarSkeleton />
        ) : (
          <StatsBar
            profile={profile}
            totalClips={totalClipsGenerated}
            creditsResetText={creditsResetText}
          />
        )}

        {/* ── Attention needed (failed jobs banner if any) ── */}
        {!jobsLoading && <AttentionNeeded jobs={jobs} />}

        {/* ── Full width jobs list ── */}
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

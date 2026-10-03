"use client";

import * as React from "react";
import { WelcomeDialog } from "@/features/dashboard/components/WelcomeDialog";
import { useCurrentUser } from "@/features/auth/queries";

export interface DashboardShellProps {}

function DashboardShell(_props: DashboardShellProps) {
  const { data: profile, isLoading } = useCurrentUser();
  const [showWelcome, setShowWelcome] = React.useState(false);

  React.useEffect(() => {
    if (profile && profile.isWelcomed === false) {
      setShowWelcome(true);
    }
  }, [profile]);

  const creditsBalance = profile?.creditsBalance ?? 0;

  return (
    <>
      <div className="flex flex-col gap-8 p-8 max-w-5xl mx-auto">
        <header className="flex flex-col gap-2">
          {isLoading ? (
            <>
              <div className="h-9 w-40 bg-muted rounded-md animate-pulse" />
              <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                {profile?.name
                  ? `Welcome back, ${profile.name}.`
                  : "Your clip studio at a glance."}
              </p>
            </>
          )}
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Credits
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {creditsBalance}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Resets{" "}
                  {profile?.creditsResetAt
                    ? new Date(profile.creditsResetAt).toLocaleDateString()
                    : "soon"}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Plan
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground capitalize">
                  {profile?.plan ?? "Free"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {profile?.plan === "free"
                    ? "Upgrade for more credits & features"
                    : "Active subscription"}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent Clips
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">0</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Create your first clip to get started
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {profile ? (
        <WelcomeDialog
          open={showWelcome}
          onOpenChange={setShowWelcome}
          creditsBalance={creditsBalance}
        />
      ) : null}
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <div className="h-3 w-20 bg-muted rounded-md animate-pulse" />
      <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
      <div className="h-3 w-40 bg-muted rounded-md animate-pulse" />
    </div>
  );
}

export { DashboardShell };

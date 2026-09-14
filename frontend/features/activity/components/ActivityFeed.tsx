"use client";

import * as React from "react";
import { ActivityFilterBar } from "./ActivityFilterBar";
import { ActivityItem } from "./ActivityItem";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { useActivities } from "../queries";
import {
  ActivityCategory,
  ActivityStatus,
  ActivityType,
} from "../types";
import { AppButton } from "@/components/common/AppButton";
import { ActivityIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                              Stats Summary Card                            */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-1.5 hover:bg-card/80 transition-colors">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", colorClass)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Empty State                                    */
/* -------------------------------------------------------------------------- */

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center">
        <ActivityIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {filtered ? "No matching activity" : "No activity yet"}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {filtered
            ? "Try changing your filters to see more results."
            : "Your activity log will appear here once you start using Blynta."}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             ActivityFeed                                   */
/* -------------------------------------------------------------------------- */

const LIMIT = 20;

export function ActivityFeed() {
  const [activeCategory, setActiveCategory] = React.useState<
    ActivityCategory | undefined
  >(undefined);
  const [activeStatus, setActiveStatus] = React.useState<
    ActivityStatus | undefined
  >(undefined);
  const [page, setPage] = React.useState(1);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [activeCategory, activeStatus]);

  const { data, isLoading, isFetching, isError } = useActivities({
    page,
    limit: LIMIT,
    category: activeCategory,
    status: activeStatus,
  });

  const activities = data?.activities ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  /* ── Compute simple stats from the whole timeline (unfiltered call) ── */
  const { data: allData } = useActivities({ limit: 1000 });
  const allActivities = allData?.activities ?? [];

  const stats = React.useMemo(() => {
    const jobsCompleted = allActivities.filter(
      (a) => a.type === ActivityType.JOB_COMPLETE
    ).length;
    const creditsUsed = allActivities
      .filter((a) => a.type === ActivityType.CREDIT_DEDUCT)
      .reduce((sum, a) => sum + (a.metadata?.amount ?? 0), 0);
    const billingEvents = allActivities.filter(
      (a) => a.category === ActivityCategory.BILLING
    ).length;
    return { jobsCompleted, creditsUsed, billingEvents, total: allData?.total ?? 0 };
  }, [allActivities, allData]);

  const isFiltered = Boolean(activeCategory || activeStatus);

  return (
    <div className="space-y-5 pb-16">
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Events"
          value={isLoading ? 0 : stats.total}
          colorClass="text-foreground"
        />
        <StatCard
          label="Jobs Completed"
          value={isLoading ? 0 : stats.jobsCompleted}
          colorClass="text-emerald-500"
        />
        <StatCard
          label="Credits Used"
          value={isLoading ? 0 : stats.creditsUsed}
          colorClass="text-amber-500"
        />
        <StatCard
          label="Billing Events"
          value={isLoading ? 0 : stats.billingEvents}
          colorClass="text-violet-500"
        />
      </div>

      {/* ── Filter Bar ── */}
      <ActivityFilterBar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        activeStatus={activeStatus}
        onSelectStatus={setActiveStatus}
      />

      {/* ── Feed Panel ── */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : isError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center text-sm text-rose-500">
          Failed to load activity. Please try refreshing.
        </div>
      ) : (
        <>
          <div
            className={cn(
              "rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden divide-y divide-border/20 transition-opacity duration-200",
              isFetching && "opacity-60"
            )}
          >
            {activities.length === 0 ? (
              <EmptyState filtered={isFiltered} />
            ) : (
              activities.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))
            )}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * LIMIT + 1}–
                  {Math.min(page * LIMIT, total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">{total}</span>{" "}
                events
              </p>
              <div className="flex items-center gap-2">
                <AppButton
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs px-3"
                >
                  Previous
                </AppButton>
                <span className="text-xs text-muted-foreground font-mono">
                  {page} / {totalPages}
                </span>
                <AppButton
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs px-3"
                >
                  Next
                </AppButton>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

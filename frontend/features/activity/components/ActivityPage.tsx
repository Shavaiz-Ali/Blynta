"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { ActivityFilterBar } from "./ActivityFilterBar";
import { ActivityItem } from "./ActivityItem";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { useActivities, activityKeys } from "../queries";
import {
  ActivityCategory,
  ActivityStatus,
  ActivityType,
} from "../types";
import {
  ActivityIcon,
  FilmIcon,
  CoinsIcon,
  CreditCardIcon,
  PlusIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                               Stats Cards                                  */
/* -------------------------------------------------------------------------- */

interface StatCardProps {
  label: string;
  value: number;
  subtext: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, subtext, icon, iconBg }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card/60 backdrop-blur-sm p-4.5 hover:border-primary/40 hover:bg-card/90 transition-all duration-200 shadow-xs flex flex-col justify-between gap-3 min-h-[110px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </span>
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs",
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground font-medium truncate">
          {subtext}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Empty State                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/70 border border-border/60 flex items-center justify-center mb-3.5 shadow-2xs">
        <ActivityIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-bold text-foreground">
        {filtered ? "No activity matching filters" : "No activity recorded yet"}
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
        {filtered
          ? "Try changing your search keywords, category, or status to find what you're looking for."
          : "Your timeline will track video conversions, AI rendering jobs, credit deductions, and logins."}
      </p>

      {filtered ? (
        <AppButton
          variant="outline"
          size="sm"
          onClick={onReset}
          className="text-xs font-semibold cursor-pointer shadow-2xs"
          icon={<RefreshCwIcon className="h-3.5 w-3.5" />}
        >
          Reset All Filters
        </AppButton>
      ) : (
        <AppButton
          variant="default"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="text-xs font-semibold cursor-pointer shadow-sm"
          icon={<PlusIcon className="h-3.5 w-3.5" />}
        >
          Create First Video
        </AppButton>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Main Activity Page                              */
/* -------------------------------------------------------------------------- */

const LIMIT = 15;

export function ActivityPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUser();

  const [activeCategory, setActiveCategory] = React.useState<
    ActivityCategory | undefined
  >(undefined);
  const [activeStatus, setActiveStatus] = React.useState<
    ActivityStatus | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Reset page to 1 when filters change
  const handleCategoryChange = (cat?: ActivityCategory) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const handleStatusChange = (status?: ActivityStatus) => {
    setActiveStatus(status);
    setPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  const handleResetFilters = () => {
    setActiveCategory(undefined);
    setActiveStatus(undefined);
    setSearchQuery("");
    setPage(1);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
  };

  const { data, isLoading, isFetching, isError } = useActivities({
    page,
    limit: LIMIT,
    category: activeCategory,
    status: activeStatus,
  });

  const rawActivities = data?.activities ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Client side search filter over returned current page activities if searchQuery is present
  const activities = React.useMemo(() => {
    if (!searchQuery.trim()) return rawActivities;
    const q = searchQuery.toLowerCase();
    return rawActivities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.entityType?.toLowerCase().includes(q) ||
        a.ipAddress?.toLowerCase().includes(q)
    );
  }, [rawActivities, searchQuery]);

  // Overall stats query
  const { data: allData } = useActivities({ limit: 1000 });
  const allActivities = allData?.activities ?? [];

  const stats = React.useMemo(() => {
    const jobsCount = allActivities.filter(
      (a) => a.category === ActivityCategory.JOB
    ).length;
    const jobsCompleted = allActivities.filter(
      (a) => a.type === ActivityType.JOB_COMPLETE
    ).length;
    const creditsUsed = allActivities
      .filter((a) => a.type === ActivityType.CREDIT_DEDUCT)
      .reduce((sum, a) => sum + (a.metadata?.amount ?? 0), 0);
    const billingEvents = allActivities.filter(
      (a) => a.category === ActivityCategory.BILLING
    ).length;

    return {
      total: allData?.total ?? total,
      jobsCount,
      jobsCompleted,
      creditsUsed,
      billingEvents,
    };
  }, [allActivities, allData, total]);

  const isFiltered = Boolean(activeCategory || activeStatus || searchQuery.trim());

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-foreground">Activity</h1>
        <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
          {total} events
        </span>
      </div>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* ── Page Header Lockup ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Activity Log<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Audit trail of clips created, AI processing jobs, credits spent, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Refresh Action */}
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            icon={
              <RefreshCwIcon
                className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")}
              />
            }
            className="h-9 text-xs font-semibold cursor-pointer shadow-2xs border-border/70"
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </AppButton>

          {/* Primary Action Button */}
          <AppButton
            variant="default"
            size="sm"
            onClick={() => router.push("/dashboard")}
            icon={<PlusIcon className="h-4 w-4" />}
            className="h-9 font-semibold shadow-sm cursor-pointer"
          >
            Create New Clips
          </AppButton>
        </div>
      </div>

      {/* ── Stats Summary Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          label="Total Events"
          value={isLoading ? 0 : stats.total}
          subtext="Lifetime account actions"
          icon={<ActivityIcon className="h-4 w-4 text-foreground" />}
          iconBg="bg-muted text-foreground border-border/60"
        />
        <StatCard
          label="Jobs & Clips"
          value={isLoading ? 0 : stats.jobsCount}
          subtext={`${stats.jobsCompleted} successfully processed`}
          icon={<FilmIcon className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10 text-primary border-primary/20"
        />
        <StatCard
          label="Credits Used"
          value={isLoading ? 0 : stats.creditsUsed}
          subtext="AI transcription & rendering"
          icon={<CoinsIcon className="h-4 w-4 text-amber-500" />}
          iconBg="bg-amber-500/10 text-amber-500 border-amber-500/20"
        />
        <StatCard
          label="Billing Events"
          value={isLoading ? 0 : stats.billingEvents}
          subtext="Invoices, plans & checkout"
          icon={<CreditCardIcon className="h-4 w-4 text-violet-500" />}
          iconBg="bg-violet-500/10 text-violet-500 border-violet-500/20"
        />
      </div>

      {/* ── Filter & Search Toolbar (using AppTabs & AppSelect) ── */}
      <ActivityFilterBar
        activeCategory={activeCategory}
        onSelectCategory={handleCategoryChange}
        activeStatus={activeStatus}
        onSelectStatus={handleStatusChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onResetFilters={handleResetFilters}
        isFiltered={isFiltered}
      />

      {/* ── Feed Content Section ── */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive font-medium shadow-xs">
          Failed to load activity log. Please check your connection and try refreshing.
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm shadow-xs overflow-hidden divide-y divide-border/30 transition-opacity duration-200",
              isFetching && "opacity-60"
            )}
          >
            {activities.length === 0 ? (
              <EmptyState filtered={isFiltered} onReset={handleResetFilters} />
            ) : (
              activities.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))
            )}
          </div>

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span>{" "}
                events
              </p>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <AppButton
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs px-3 cursor-pointer shadow-2xs"
                  icon={<ChevronLeftIcon className="h-3.5 w-3.5" />}
                >
                  Previous
                </AppButton>

                <span className="text-xs text-muted-foreground font-mono px-2 py-1 rounded-md bg-muted/60">
                  {page} / {totalPages}
                </span>

                <AppButton
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs px-3 cursor-pointer shadow-2xs"
                >
                  <span>Next</span>
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-1" />
                </AppButton>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

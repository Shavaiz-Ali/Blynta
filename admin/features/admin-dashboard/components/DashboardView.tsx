"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { DashboardRange } from "../api";
import { useDashboardStatsQuery } from "../queries";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common/AppCard";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewMetrics } from "./OverviewMetrics";
import { DashboardActivityChart, DashboardBreakdowns } from "./DashboardCharts";
import { QueueSnapshot, RecentActivity } from "./RecentActivity";

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <AppCard key={index} className="min-h-48 p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-7 h-10 w-32" />
            <Skeleton className="mt-auto h-4 w-44" />
          </AppCard>
        ))}
      </div>
      <AppCard className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-80 w-full" />
      </AppCard>
    </div>
  );
}

export function DashboardView() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const query = useDashboardStatsQuery(range);

  return (
    <div className="space-y-5 lg:space-y-6">
      <AppPageHeader
        title="Platform overview"
        description="Live account, processing, subscription, and system operations."
        action={(
          <div className="flex items-center gap-3">
            {query.dataUpdatedAt > 0 && (
              <span className="hidden text-xs text-muted-foreground md:inline">
                Updated {new Date(query.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <AppButton variant="outline" isLoading={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw />
              Refresh
            </AppButton>
          </div>
        )}
      />

      {query.isError ? (
        <QueryErrorState
          title="Overview unavailable"
          description="The dashboard API could not be reached. Check the backend and try again."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.isLoading || !query.data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <OverviewMetrics data={query.data} />
          <DashboardActivityChart data={query.data} range={range} onRangeChange={setRange} />
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)]">
            <QueueSnapshot queues={query.data.queueHealth} />
            <RecentActivity events={query.data.recentAudit || []} />
          </section>
          <DashboardBreakdowns data={query.data} />
        </>
      )}
    </div>
  );
}

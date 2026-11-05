"use client";
import { AppPageHeader } from "@/components/common/AppPageHeader";

import * as React from "react";
import { useAdminQueuesQuery } from "@/features/admin-jobs/queries";
import {
  AppCard as Card,
  AppCardContent as CardContent,
  AppCardDescription as CardDescription,
  AppCardHeader as CardHeader,
  AppCardTitle as CardTitle,
} from "@/components/common/primitives";
import { AppBadge as Badge } from "@/components/common/primitives";
import { AppSkeleton as Skeleton } from "@/components/common/primitives";
import { AppButton } from "@blynta/ui";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  RefreshCw,
  Zap,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";

export function QueuesView() {
  const {
    data: queues,
    isLoading,
    isFetching,
    isError,
    refetch,
    dataUpdatedAt,
  } = useAdminQueuesQuery();

  const handleRefresh = async () => {
    await refetch();
  };

  const totalActive = queues?.reduce((acc, q) => acc + q.active, 0) ?? 0;
  const totalWaiting = queues?.reduce((acc, q) => acc + q.waiting, 0) ?? 0;
  const totalFailed = queues?.reduce((acc, q) => acc + q.failed, 0) ?? 0;

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <AppPageHeader
          title="Queues & Worker Topologies"
          description="BullMQ processing and background worker health."
        />
        <QueryErrorState
          title="Queue telemetry is unavailable"
          description="Redis and BullMQ metrics could not be retrieved. No healthy status is being assumed."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <AppPageHeader
        title="Queues & Worker Topologies"
        description="Monitor video processing queues and background workers."
        action={
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-muted-foreground">
                Auto-polls every 15s
              </p>
              <p className="text-xs font-semibold text-foreground">
                {dataUpdatedAt
                  ? format(dataUpdatedAt, "h:mm:ss a")
                  : "Awaiting telemetry"}
              </p>
            </div>
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="h-8 gap-2 text-xs font-semibold shadow-2xs border-border/70 cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin text-primary" : ""}`}
              />
              <span>{isFetching ? "Refreshing..." : "Refresh"}</span>
            </AppButton>
          </div>
        }
      />

      {/* Overview Stat Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
              Total In-Flight (Active)
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-primary tabular-nums">
              {totalActive}
            </span>
          </div>
          <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Zap className="size-5" />
          </div>
        </Card>

        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
              Queued / Waiting
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
              {totalWaiting}
            </span>
          </div>
          <div className="size-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/50">
            <Clock className="size-5" />
          </div>
        </Card>

        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-colors p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
              Worker Dead Letter / Failed
            </span>
            <span
              className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${totalFailed > 0 ? "text-destructive" : "text-primary"}`}
            >
              {totalFailed}
            </span>
          </div>
          <div
            className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${totalFailed > 0 ? "bg-destructive/15 text-destructive border-destructive/25" : "bg-primary/15 text-primary border-primary/20"}`}
          >
            <AlertTriangle className="size-5" />
          </div>
        </Card>
      </section>

      {/* Detailed Queue Cards */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Layers className="size-3.5 text-primary" /> Registered BullMQ Queues (
          {queues?.length || 5})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            : queues?.map((queue) => (
                <Card
                  key={queue.name}
                  className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden transition-colors"
                >
                  <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                          {queue.label}
                        </CardTitle>
                        <CardDescription className="text-[11px] font-mono mt-0.5 text-muted-foreground">
                          queue: {queue.name}
                        </CardDescription>
                      </div>

                      <AppStatusBadge
                        status={
                          !queue.isHealthy
                            ? "unavailable"
                            : queue.paused
                              ? "paused"
                              : "active"
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-center font-mono sm:grid-cols-4">
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-sans font-semibold">
                          Active
                        </span>
                        <span className="text-base font-bold text-primary tabular-nums">
                          {queue.active}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-sans font-semibold">
                          Waiting
                        </span>
                        <span className="text-base font-bold text-foreground tabular-nums">
                          {queue.waiting}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-sans font-semibold">
                          Completed
                        </span>
                        <span className="text-base font-bold text-primary tabular-nums">
                          {queue.completed}
                        </span>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border ${queue.failed > 0 ? "bg-destructive/10 border-destructive/25 text-destructive" : "bg-muted/40 border-border/60"}`}
                      >
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-sans font-semibold">
                          Failed
                        </span>
                        <span
                          className={`text-base font-bold tabular-nums ${queue.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {queue.failed}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3 text-muted-foreground" /> Delayed Jobs:{" "}
                        <strong className="text-foreground font-mono">
                          {queue.delayed}
                        </strong>
                      </span>
                      {queue.name === "media-processing" && (
                        <Link
                          href="/jobs"
                          className="text-primary font-semibold hover:underline flex items-center gap-1"
                        >
                          Inspect Render Jobs{" "}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </section>
    </div>
  );
}

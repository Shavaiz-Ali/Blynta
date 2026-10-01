"use client";

import * as React from "react";
import { useAdminQueuesQuery } from "@/features/admin-jobs/queries";
import { AppCard as Card, AppCardContent as CardContent, AppCardDescription as CardDescription, AppCardHeader as CardHeader, AppCardTitle as CardTitle } from "@/components/common/primitives";
import { AppBadge as Badge } from "@/components/common/primitives";
import { AppSkeleton as Skeleton } from "@/components/common/primitives";
import { AppButton } from "@/components/common/AppButton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  Server,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Play,
  Pause,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export function QueuesView() {
  const { data: queues, isLoading, isFetching, isError, refetch } = useAdminQueuesQuery();
  const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date());

  const handleRefresh = async () => {
    await refetch();
    setLastRefreshed(new Date());
  };

  const totalActive = queues?.reduce((acc, q) => acc + q.active, 0) ?? 0;
  const totalWaiting = queues?.reduce((acc, q) => acc + q.waiting, 0) ?? 0;
  const totalFailed = queues?.reduce((acc, q) => acc + q.failed, 0) ?? 0;

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-b border-border/80 pb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Queues &amp; Worker Topologies</h1>
          <p className="mt-1 text-xs text-muted-foreground">BullMQ processing and background worker health.</p>
        </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Server className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Queues & Worker Topologies
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live Redis & BullMQ message broker monitoring for dedicated video rendering and background microservices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-muted-foreground">Auto-polls every 15s</p>
            <p className="text-xs font-medium text-foreground">
              {format(lastRefreshed, "h:mm:ss a")}
            </p>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
            <span>{isFetching ? "Refreshing..." : "Refresh Telemetry"}</span>
          </AppButton>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                Total In-Flight (Active)
              </span>
              <span className="text-2xl font-bold text-primary">{totalActive}</span>
            </div>
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Zap className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                Queued / Waiting
              </span>
              <span className="text-2xl font-bold text-foreground">{totalWaiting}</span>
            </div>
            <div className="size-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                Worker Dead Letter / Failed
              </span>
              <span className={`text-2xl font-bold ${totalFailed > 0 ? "text-destructive" : "text-primary"}`}>
                {totalFailed}
              </span>
            </div>
            <div className={`size-9 rounded-lg flex items-center justify-center ${totalFailed > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              <AlertTriangle className="size-4" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Detailed Queue Cards */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Layers className="size-3.5" /> Registered BullMQ Queues ({queues?.length || 5})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))
          ) : (
            queues?.map((queue) => (
              <Card key={queue.name} className="border-border/80 bg-card shadow-xs overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        {queue.label}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5">
                        queue: {queue.name}
                      </CardDescription>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-xs font-mono ${
                        queue.isHealthy && queue.failed === 0
                          ? "text-primary dark:text-primary border-primary/30 bg-primary/10"
                          : "text-primary dark:text-primary border-primary/30 bg-primary/10"
                      }`}
                    >
                      {queue.isHealthy ? "ONLINE" : "UNREACHABLE"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center font-mono sm:grid-cols-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-[10px] text-muted-foreground block font-sans">Active</span>
                      <span className="text-base font-bold text-primary">{queue.active}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                      <span className="text-[10px] text-muted-foreground block font-sans">Waiting</span>
                      <span className="text-base font-bold text-foreground">{queue.waiting}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-[10px] text-muted-foreground block font-sans">Completed</span>
                      <span className="text-base font-bold text-primary">{queue.completed}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${queue.failed > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/50 border-border"}`}>
                      <span className="text-[10px] text-muted-foreground block font-sans">Failed</span>
                      <span className={`text-base font-bold ${queue.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {queue.failed}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3" /> Delayed Jobs: <strong className="text-foreground font-mono">{queue.delayed}</strong>
                    </span>
                    {queue.name === "media-processing" && (
                      <Link
                        href="/jobs"
                        className="text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        Inspect Render Jobs <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}



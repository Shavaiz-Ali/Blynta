"use client";
import { useAdminQueuesQuery } from "@/features/admin-jobs/queries";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { DataTable } from "@/components/common/DataTable";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { AppButton } from "@blynta/ui";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Activity, RefreshCw } from "lucide-react";

export function SystemHealthView() {
  const query = useAdminQueuesQuery();
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="System health"
        description="Queue connectivity and reported failures. Worker liveness is not independently monitored."
        action={
          <AppButton
            variant="outline"
            size="sm"
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            className="h-8 gap-1.5 shadow-2xs border-border/70 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin text-primary" : ""}`} />
            Refresh
          </AppButton>
        }
      />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>
              {query.dataUpdatedAt
                ? `Telemetry checked at ${new Date(query.dataUpdatedAt).toLocaleTimeString()}`
                : "Checking queues…"}
            </span>
          </div>
          <DataTable
            loading={query.isLoading}
            data={(query.data || []).map((q) => ({ ...q, id: q.name }))}
            columns={[
              { key: "label", header: "Queue" },
              {
                key: "isHealthy",
                header: "Connectivity",
                render: (q) => (
                  <AppStatusBadge
                    status={
                      q.isHealthy
                        ? q.paused
                          ? "paused"
                          : "connected"
                        : "unavailable"
                    }
                  />
                ),
              },
              { key: "active", header: "Active" },
              { key: "waiting", header: "Waiting" },
              { key: "failed", header: "Retained failures" },
            ]}
          />
        </>
      )}
      <section className="border-t pt-5">
        <h2 className="font-medium">Additional services</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Database, storage, authentication, AI providers, email, and payments
          have no dedicated health probes in this console. Their status is
          unknown.
        </p>
      </section>
    </div>
  );
}

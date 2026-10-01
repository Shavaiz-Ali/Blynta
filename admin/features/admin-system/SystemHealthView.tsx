"use client";
import { useAdminQueuesQuery } from "@/features/admin-jobs/queries";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { DataTable } from "@/components/common/DataTable";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { AppButton } from "@/components/common/AppButton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
export function SystemHealthView() {
  const query = useAdminQueuesQuery();
  return <div className="space-y-6"><AppPageHeader title="System health" description="Queue connectivity and reported failures. Worker liveness is not independently monitored." action={<AppButton variant="outline" isLoading={query.isFetching} onClick={() => void query.refetch()}>Refresh</AppButton>} />{query.isError ? <QueryErrorState onRetry={() => void query.refetch()} /> : <><p className="text-xs text-muted-foreground">{query.dataUpdatedAt ? `Last checked ${new Date(query.dataUpdatedAt).toLocaleString()}` : "Checking queues…"}</p><DataTable loading={query.isLoading} data={(query.data || []).map(q => ({ ...q, id: q.name }))} columns={[{ key: "label", header: "Queue" }, { key: "isHealthy", header: "Connectivity", render: q => <AppStatusBadge status={q.isHealthy ? q.paused ? "paused" : "connected" : "unavailable"} /> }, { key: "active", header: "Active" }, { key: "waiting", header: "Waiting" }, { key: "failed", header: "Retained failures" }]} /></>}<section className="border-t pt-5"><h2 className="font-medium">Additional services</h2><p className="mt-2 text-sm text-muted-foreground">Database, storage, authentication, AI providers, email, and payments have no dedicated health probes in this console. Their status is unknown.</p></section></div>;
}


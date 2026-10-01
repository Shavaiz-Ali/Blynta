"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useAnalytics } from "./queries";
import { analyticsMetrics } from "./service";
import type { Metric } from "./types";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { AppSpinner } from "@/components/common/AppSpinner";
import { DataTable } from "@/components/common/DataTable";
const Chart = dynamic(() => import("@/components/common/AppChart").then(m => m.AppChart), { ssr: false, loading: () => <AppSpinner /> });
export function AnalyticsView() {
  const [metric, setMetric] = useState<Metric>("newUsers"); const query = useAnalytics({ metric, dimension: "date", range: "14d", aggregation: "sum" });
  return <div className="space-y-6"><AppPageHeader title="Analytics" description="Daily user growth and processing outcomes · last 14 days" /><label className="flex items-center gap-3 text-sm">Metric<select className="rounded-md border bg-background p-2" value={metric} onChange={e => setMetric(e.target.value as Metric)}>{Object.entries(analyticsMetrics).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{query.isError ? <QueryErrorState onRetry={() => void query.refetch()} /> : query.isLoading ? <AppSpinner /> : query.data?.points.length ? <><Chart points={query.data.points} label={analyticsMetrics[metric]} /><details><summary className="cursor-pointer text-sm">View source values</summary><DataTable data={query.data.points.map(p => ({ ...p, id: p.date }))} columns={[{ key: "date", header: "Date" }, { key: "value", header: analyticsMetrics[metric] }]} /></details></> : <p className="text-sm text-muted-foreground">No measurements were returned for this period.</p>}</div>;
}


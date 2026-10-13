"use client";
import { AppSelect } from "@blynta/ui";
import { SelectItem } from "@blynta/ui/primitives/select";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useAnalytics } from "./queries";
import { analyticsMetrics } from "./service";
import type { Metric } from "./types";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { AppSpinner } from "@blynta/ui";
import { DataTable } from "@/components/common/DataTable";
const Chart = dynamic(
  () => import("@/components/common/AppChart").then((m) => m.AppChart),
  { ssr: false, loading: () => <AppSpinner /> },
);
export function AnalyticsView() {
  const [metric, setMetric] = useState<Metric>("newUsers");
  const query = useAnalytics({
    metric,
    dimension: "date",
    range: "14d",
    aggregation: "sum",
  });
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Analytics"
        description="Daily user growth and processing outcomes · last 14 days"
      />
      <label className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm">
        Metric
        <AppSelect
          aria-label="Metric"
          wrapperClassName="w-full sm:w-64"
          value={metric}
          onValueChange={(e) => setMetric(e as Metric)}
        >
          {Object.entries(analyticsMetrics).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </AppSelect>
      </label>
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <AppSpinner />
      ) : query.data?.points.length ? (
        <>
          <Chart points={query.data.points} label={analyticsMetrics[metric]} />
          <details className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              View source values
            </summary>
            <DataTable
              data={query.data.points.map((p) => ({ ...p, id: p.date }))}
              columns={[
                { key: "date", header: "Date" },
                { key: "value", header: analyticsMetrics[metric] },
              ]}
            />
          </details>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No measurements were returned for this period.
        </p>
      )}
    </div>
  );
}

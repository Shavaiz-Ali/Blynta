"use client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@blynta/ui";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppDialog, AppButton, AppSpinner } from "@blynta/ui";
import type { CreditHistoryPage } from "@blynta/types";
import { axiosClient } from "@/config/axiosClient";

interface Picture {
  consistent: boolean;
  balance: { available: number; reserved: number };
  history: CreditHistoryPage;
  reservations: {
    operationId: string;
    authorized: number;
    held: number;
    product: string;
  }[];
  usage: {
    _id: string;
    stage: string;
    operationId: string;
    metrics: Record<string, unknown>;
    recordedAt: string;
  }[];
}
export function CreditDetails({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const data = useQuery({
    queryKey: ["admin-billing", "credit-details", userId, page],
    queryFn: async () =>
      (
        await axiosClient.get<Picture>(
          `/admin/billing/customers/${userId}/credits`,
          { params: { page, limit: 20 } },
        )
      ).data,
    enabled: !!userId,
    refetchInterval: 15000,
  });
  return (
    <AppDialog
      open={!!userId}
      onOpenChange={(open) => {
        if (!open) {
          setPage(1);
          onClose();
        }
      }}
      title="Credit accounting and processing costs"
      size="lg"
    >
      {data.isPending && (
        <div className="py-8 flex justify-center">
          <AppSpinner />
        </div>
      )}
      {data.error && (
        <div role="alert" className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-2">
          <p>{data.error.message}</p>
          <AppButton size="sm" variant="outline" onClick={() => void data.refetch()}>
            Retry
          </AppButton>
        </div>
      )}
      {data.data && (
        <div className="space-y-5 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-foreground">
                {data.data.balance.available} available
              </span>{" "}
              ·{" "}
              <span className="text-muted-foreground">
                {data.data.balance.reserved} reserved
              </span>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                data.data.consistent
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              Ledger {data.data.consistent ? "Consistent" : "Requires Investigation"}
            </span>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Active reservations
            </h3>
            {data.data.reservations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No active reservations</p>
            ) : (
              <div className="space-y-1.5">
                {data.data.reservations.map((r) => (
                  <div
                    key={r.operationId}
                    className="p-2.5 rounded-lg border border-border/60 bg-card text-xs flex justify-between items-center"
                  >
                    <span>
                      <strong className="text-foreground">{r.product}</strong> —{" "}
                      {r.held} held / {r.authorized} authorized
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {r.operationId}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Transaction History
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
              <Table className="w-full text-left text-xs">
                <TableHeader className="bg-muted/30 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-2.5">Date</TableHead>
                    <TableHead className="px-4 py-2.5">Product</TableHead>
                    <TableHead className="px-4 py-2.5">Type</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {data.data.history.rows.map((e) => (
                    <TableRow className="hover:bg-muted/20" key={e._id}>
                      <TableCell className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 font-medium">{e.product}</TableCell>
                      <TableCell className="px-4 py-2.5 capitalize">{e.type}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right font-bold tabular-nums">
                        {e.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <span>Page {page}</span>
            <div className="flex gap-2">
              <AppButton
                variant="outline"
                size="sm"
                className="h-8 shadow-2xs border-border/70"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </AppButton>
              <AppButton
                variant="outline"
                size="sm"
                className="h-8 shadow-2xs border-border/70"
                disabled={page >= data.data.history.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </AppButton>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Internal processing measurements
            </h3>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Latest 100 samples for operations on this page. Unknown costs are
              not treated as zero. Estimates depend on configured provider rates.
            </p>
            {data.data.usage.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No cost measurements recorded.</p>
            ) : (
              <div className="space-y-2">
                {data.data.usage.map((u) => (
                  <details
                    key={u._id}
                    className="rounded-lg border border-border/60 bg-card p-2.5 text-xs transition-colors"
                  >
                    <summary className="font-semibold text-foreground cursor-pointer outline-none hover:text-primary">
                      {u.stage} · {new Date(u.recordedAt).toLocaleString()} ·{" "}
                      {typeof u.metrics.estimatedCostUsd === "number"
                        ? `$${u.metrics.estimatedCostUsd.toFixed(6)}`
                        : "Cost unknown"}
                    </summary>
                    <pre className="overflow-auto text-[11px] font-mono mt-2 p-2 bg-muted/40 rounded border border-border/40">
                      {JSON.stringify(u.metrics, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppDialog>
  );
}

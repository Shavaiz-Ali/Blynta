"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppDialog, AppButton } from "@blynta/ui";
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
      {data.isPending && <p role="status">Loading credit records…</p>}
      {data.error && (
        <p role="alert">
          {data.error.message}{" "}
          <button onClick={() => void data.refetch()}>Retry</button>
        </p>
      )}
      {data.data && (
        <div className="space-y-5 text-sm">
          <p>
            <strong>
              {data.data.balance.available} available ·{" "}
              {data.data.balance.reserved} reserved
            </strong>{" "}
            · Ledger{" "}
            {data.data.consistent
              ? "matches balance"
              : "requires investigation"}
          </p>
          <div>
            <h3 className="font-semibold mb-2">Active reservations</h3>
            {data.data.reservations.length === 0 ? (
              <p className="text-muted-foreground">None</p>
            ) : (
              data.data.reservations.map((r) => (
                <p key={r.operationId}>
                  {r.product} — {r.held} held / {r.authorized} authorized{" "}
                  <span className="font-mono text-xs">{r.operationId}</span>
                </p>
              ))
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.data.history.rows.map((e) => (
                  <tr className="border-t" key={e._id}>
                    <td className="py-2">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td>{e.product}</td>
                    <td>{e.type}</td>
                    <td>{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 items-center">
            <AppButton
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </AppButton>
            <span>Page {page}</span>
            <AppButton
              variant="outline"
              disabled={page >= data.data.history.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </AppButton>
          </div>
          <div>
            <h3 className="font-semibold mb-2">
              Internal processing measurements
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Latest 100 samples for operations on this page. Unknown costs are
              not treated as zero. Estimates depend on configured provider
              rates.
            </p>
            {data.data.usage.length === 0 && (
              <p>No cost measurements recorded.</p>
            )}
            {data.data.usage.map((u) => (
              <details key={u._id} className="border-t py-2">
                <summary>
                  {u.stage} · {new Date(u.recordedAt).toLocaleString()} ·{" "}
                  {typeof u.metrics.estimatedCostUsd === "number"
                    ? `$${u.metrics.estimatedCostUsd.toFixed(6)}`
                    : "Cost unknown"}
                </summary>
                <pre className="overflow-auto text-xs mt-2">
                  {JSON.stringify(u.metrics, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </AppDialog>
  );
}

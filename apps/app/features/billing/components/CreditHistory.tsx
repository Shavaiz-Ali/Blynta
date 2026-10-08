"use client";
import { useState } from "react";
import { AppButton } from "@blynta/ui";
import { useCreditHistory } from "../queries";

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState("");
  const [type, setType] = useState("");
  const history = useCreditHistory(page, product, type);
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-base font-bold">Credit usage history</h2>
        <div className="flex gap-2">
          <select
            aria-label="Filter by product"
            className="rounded-lg border bg-background p-2 text-sm"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All products</option>
            <option value="ai-clips">AI Clips</option>
            <option value="studio">Studio</option>
            <option value="account">Account</option>
          </select>
          <select
            aria-label="Filter by transaction type"
            className="rounded-lg border bg-background p-2 text-sm"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All transactions</option>
            {[
              "charge",
              "reserve",
              "release",
              "grant",
              "refund",
              "adjustment",
              "opening",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {history.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading usage…
        </p>
      )}
      {history.error && (
        <div role="alert">
          <p>Could not load credit history.</p>
          <AppButton variant="outline" onClick={() => void history.refetch()}>
            Try again
          </AppButton>
        </div>
      )}
      {history.data?.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No transactions match these filters. Existing credits appear as an
          opening balance when ledger accounting begins.
        </p>
      )}
      {!!history.data?.rows.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {[
                  "Date",
                  "Product / operation",
                  "Credits",
                  "Status",
                  "Related work",
                ].map((h) => (
                  <th className="pb-3 pr-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.data.rows.map((e) => (
                <tr className="border-t border-border/50" key={e._id}>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <strong>
                      {e.product === "ai-clips"
                        ? "AI Clips"
                        : e.product === "studio"
                          ? "Studio"
                          : "Account"}
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      {e.description}
                    </p>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {e.type === "reserve"
                      ? `${e.amount} held`
                      : e.type === "release"
                        ? `${e.amount} unlocked`
                        : e.type === "charge"
                          ? `−${e.amount}`
                          : `${e.availableDelta >= 0 ? "+" : "−"}${Math.abs(e.availableDelta)}`}
                  </td>
                  <td className="py-3 pr-4 capitalize">
                    {e.type === "reserve"
                      ? "Hold"
                      : e.type === "release"
                        ? "Released hold"
                        : e.type === "charge"
                          ? "Charged"
                          : e.type}
                  </td>
                  <td className="py-3 font-mono text-xs">
                    {e.relatedId ? (
                      <a
                        className="underline"
                        href={
                          e.product === "ai-clips"
                            ? `/my-clips/${e.relatedId}`
                            : undefined
                        }
                      >
                        {e.relatedId.slice(-8)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Holds reserve existing credits; released holds restore availability.
        They are not new credit grants.
      </p>
      <div className="flex justify-end items-center gap-3 text-xs">
        <AppButton
          variant="outline"
          disabled={page === 1 || history.isPending}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </AppButton>
        <span>
          Page {page} of {Math.max(1, history.data?.totalPages || 0)}
        </span>
        <AppButton
          variant="outline"
          disabled={!history.data || page >= history.data.totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </AppButton>
      </div>
    </section>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import {
  AppButton,
  AppSelect,
  AppPagination,
  AppCardRoot,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@blynta/ui";
import type { CreditTransaction } from "@blynta/types";
import { useCreditHistory } from "../queries";

const products = [
  ["", "All products"],
  ["ai-clips", "AI Clips"],
  ["studio", "Studio"],
  ["account", "Account"],
];
const transactions = [
  ["", "All transactions"],
  ["charge", "Charges"],
  ["reserve", "Reservations"],
  ["release", "Releases"],
  ["grant", "Credit grants"],
  ["refund", "Refunds"],
  ["adjustment", "Adjustments"],
  ["opening", "Opening balance"],
];
const labels = {
  reserve: "Reserved",
  release: "Released",
  charge: "Charged",
  grant: "Credit grant",
  refund: "Refund",
  adjustment: "Adjustment",
  opening: "Opening balance",
};
function creditAmount(entry: CreditTransaction) {
  if (entry.type === "reserve") return `${entry.amount.toLocaleString()} held`;
  if (entry.type === "release")
    return `${entry.amount.toLocaleString()} unlocked`;
  if (entry.type === "charge") return `−${entry.amount.toLocaleString()}`;
  return `${entry.availableDelta >= 0 ? "+" : "−"}${Math.abs(entry.availableDelta).toLocaleString()}`;
}

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState("");
  const [type, setType] = useState("");
  const history = useCreditHistory(page, product, type);
  const rows = history.data?.rows ?? [];
  const busy = history.isFetching || history.isPending;
  return (
    <section aria-labelledby="credit-history" className="min-w-0">
      <AppCardRoot>
        <AppCardHeader>
          <AppCardTitle id="credit-history">Credit usage history</AppCardTitle>
          <AppCardDescription>
            Credits added, held, spent and returned.
          </AppCardDescription>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:max-w-lg">
            {[
              {
                label: "Filter by product",
                value: product,
                options: products,
                update: setProduct,
              },
              {
                label: "Filter by transaction type",
                value: type,
                options: transactions,
                update: setType,
              },
            ].map((filter) => (
              <AppSelect
                key={filter.label}
                aria-label={filter.label}
                value={filter.value || "all"}
                size="sm"
                options={filter.options.map(([value, label]) => ({
                  value: value || "all",
                  label,
                }))}
                onValueChange={(value) => {
                  filter.update(value === "all" ? "" : value);
                  setPage(1);
                }}
              />
            ))}
          </div>
        </AppCardHeader>
        <AppCardContent className="min-w-0 space-y-4">
          {history.isPending ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Loading credit history…
            </p>
          ) : history.error ? (
            <div role="alert" className="space-y-3 py-4">
              <p className="text-sm text-destructive">
                Could not load credit history.
              </p>
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => history.refetch()}
              >
                Try again
              </AppButton>
            </div>
          ) : rows.length === 0 ? (
            <div role="status" className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                No transactions match these filters.
              </p>
              {(product || type) && (
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProduct("");
                    setType("");
                    setPage(1);
                  }}
                >
                  Clear filters
                </AppButton>
              )}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Credit transactions and recorded balance movements
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Related job or payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell>
                      <p className="font-medium">{labels[entry.type]}</p>
                      <p className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium tabular-nums">
                      {creditAmount(entry)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <time dateTime={entry.createdAt}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </TableCell>
                    <TableCell>
                      {entry.relatedId ? (
                        entry.product === "ai-clips" ? (
                          <Link
                            className="text-primary underline-offset-4 hover:underline"
                            href={`/my-clips/${entry.relatedId}`}
                          >
                            View video
                          </Link>
                        ) : (
                          <span
                            className="block max-w-48 truncate text-xs"
                            title={entry.relatedId}
                          >
                            {entry.relatedId}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AppBadge variant="secondary">Recorded</AppBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground">
            Holds reserve existing credits; releases restore availability. They
            are not new credit grants. Status describes the recorded
            transaction, not the current job status.
          </p>
          <AppPagination
            page={page}
            totalPages={history.data?.totalPages ?? 1}
            total={history.data?.total ?? 0}
            disabled={busy || !!history.error}
            onPageChange={setPage}
          />
        </AppCardContent>
      </AppCardRoot>
    </section>
  );
}

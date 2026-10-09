"use client";
import { useState } from "react";
import { AppButton, AppDropdown } from "@blynta/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  History,
  LockKeyhole,
  RotateCcw,
  UnlockKeyhole,
} from "lucide-react";
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
const presentation = {
  reserve: {
    label: "Reserved",
    detail: "Reservation recorded",
    Icon: LockKeyhole,
    color: "text-amber-400 bg-amber-400/10",
  },
  release: {
    label: "Released",
    detail: "Returned to available balance",
    Icon: UnlockKeyhole,
    color: "text-sky-400 bg-sky-400/10",
  },
  charge: {
    label: "Charged",
    detail: "Charge recorded",
    Icon: ArrowUpRight,
    color: "text-foreground bg-muted",
  },
  grant: {
    label: "Credit grant",
    detail: "Added to your balance",
    Icon: ArrowDownLeft,
    color: "text-emerald-400 bg-emerald-400/10",
  },
  refund: {
    label: "Refund",
    detail: "Refund recorded",
    Icon: RotateCcw,
    color: "text-emerald-400 bg-emerald-400/10",
  },
  adjustment: {
    label: "Adjustment",
    detail: "Balance correction recorded",
    Icon: RotateCcw,
    color: "text-foreground bg-muted",
  },
  opening: {
    label: "Opening balance",
    detail: "Balance carried forward",
    Icon: ArrowDownLeft,
    color: "text-foreground bg-muted",
  },
};
function creditAmount(entry: CreditTransaction) {
  if (entry.type === "reserve") return entry.amount.toLocaleString() + " held";
  if (entry.type === "release")
    return entry.amount.toLocaleString() + " unlocked";
  if (entry.type === "charge") return "−" + entry.amount.toLocaleString();
  return (
    (entry.availableDelta >= 0 ? "+" : "−") +
    Math.abs(entry.availableDelta).toLocaleString()
  );
}
export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState("");
  const [type, setType] = useState("");
  const history = useCreditHistory(page, product, type);
  const busy = history.isFetching || history.isPending;
  const rows = history.data?.rows ?? [];
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <History className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold">Credit usage history</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Track credits added, reserved, spent and returned.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
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
            <AppDropdown
              key={filter.label}
              align="end"
              label={filter.label}
              trigger={
                <AppButton
                  variant="outline"
                  size="sm"
                  aria-label={
                    filter.label +
                    ": " +
                    filter.options.find(
                      ([value]) => value === filter.value,
                    )?.[1]
                  }
                  className="h-10 min-w-0 w-full justify-between gap-2 sm:w-auto sm:min-w-40"
                  contentClassName="w-full justify-between"
                >
                  <span className="truncate">
                    {
                      filter.options.find(
                        ([value]) => value === filter.value,
                      )?.[1]
                    }
                  </span>
                  <ChevronDown className="size-3.5 shrink-0" />
                </AppButton>
              }
              items={filter.options.map(([value, label]) => ({
                key: label,
                label,
                icon:
                  value === filter.value ? (
                    <Check className="size-3.5" />
                  ) : undefined,
                onClick: () => {
                  filter.update(value);
                  setPage(1);
                },
              }))}
            />
          ))}
        </div>
      </div>
      {history.isPending ? (
        <div
          role="status"
          aria-label="Loading credit history"
          className="space-y-3 border-t border-border/50 p-6"
        >
          <span className="sr-only">Loading usage…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-muted/60"
            />
          ))}
        </div>
      ) : history.error ? (
        <div
          role="alert"
          className="space-y-3 border-t border-border/50 px-6 py-10 text-center"
        >
          <p className="font-medium">Could not load credit history.</p>
          <p className="text-sm text-muted-foreground">
            Please try again to see your latest transactions.
          </p>
          <AppButton variant="outline" onClick={() => void history.refetch()}>
            Try again
          </AppButton>
        </div>
      ) : rows.length === 0 ? (
        <div
          role="status"
          className="border-t border-border/50 px-6 py-10 text-center"
        >
          <History
            className="mx-auto mb-3 size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">
            No transactions match these filters.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Your credit activity will appear here. Existing credits are shown as
            an opening balance when ledger accounting begins.
          </p>
          {(product || type) && (
            <AppButton
              variant="ghost"
              size="sm"
              className="mt-3"
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
        <div
          className="overflow-x-auto"
          tabIndex={0}
          aria-label="Credit transactions"
          role="region"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Credit transactions and recorded balance movements
            </caption>
            <thead className="border-y border-border/50 bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 sm:px-6">
                  Transaction
                </th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">
                  Date
                </th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                  Recorded action
                </th>
                <th scope="col" className="px-5 py-3 text-right sm:px-6">
                  Credits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((entry) => {
                const view = presentation[entry.type];
                const Icon = view.Icon;
                const date = new Date(entry.createdAt);
                return (
                  <tr
                    key={entry._id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex items-start gap-3">
                        <span
                          className={
                            "mt-0.5 hidden rounded-lg p-2 sm:block " +
                            view.color
                          }
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {view.label}{" "}
                            <span className="font-normal text-muted-foreground">
                              ·{" "}
                              {entry.product === "ai-clips"
                                ? "AI Clips"
                                : entry.product === "studio"
                                  ? "Studio"
                                  : "Account"}
                            </span>
                          </p>
                          <p className="mt-1 max-w-sm break-words text-xs leading-relaxed text-muted-foreground">
                            {entry.description}
                          </p>
                          {entry.relatedId && (
                            <p className="mt-1 text-xs">
                              {entry.product === "ai-clips" ? (
                                <a
                                  className="font-medium text-primary underline-offset-4 hover:underline"
                                  href={"/my-clips/" + entry.relatedId}
                                >
                                  View video{" "}
                                  <span className="sr-only">
                                    {entry.relatedId}
                                  </span>
                                </a>
                              ) : (
                                <span className="text-muted-foreground">
                                  Reference {entry.relatedId.slice(-8)}
                                </span>
                              )}
                            </p>
                          )}
                          <time
                            dateTime={entry.createdAt}
                            className="mt-1 block text-[11px] text-muted-foreground md:hidden"
                          >
                            {date.toLocaleString()}
                          </time>
                        </div>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-4 md:table-cell">
                      <time dateTime={entry.createdAt}>
                        {date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {date.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </time>
                    </td>
                    <td className="hidden px-4 py-4 lg:table-cell">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium " +
                          view.color
                        }
                      >
                        {view.label}
                      </span>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {view.detail}
                      </p>
                    </td>
                    <td
                      className={
                        "whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums sm:px-6 " +
                        (entry.type === "charge"
                          ? "text-foreground"
                          : entry.type === "reserve"
                            ? "text-amber-400"
                            : entry.type === "release"
                              ? "text-sky-400"
                              : entry.availableDelta > 0
                                ? "text-emerald-400"
                                : "text-foreground")
                      }
                    >
                      {creditAmount(entry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-col gap-4 border-t border-border/50 bg-muted/10 p-5 sm:p-6">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Holds reserve existing credits; releases restore availability. They
          are not new credit grants. Entries show recorded actions, not the
          current status of a job.
        </p>
        <nav
          aria-label="Credit history pages"
          className="flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <span aria-live="polite" className="text-muted-foreground">
            {history.error
              ? "History unavailable"
              : "Page " +
                page +
                " of " +
                Math.max(1, history.data?.totalPages || 0)}
            {history.data && !history.error
              ? " · " + history.data.total + " transactions"
              : ""}
          </span>
          <div className="flex gap-2">
            <AppButton
              size="sm"
              variant="outline"
              disabled={page === 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </AppButton>
            <AppButton
              size="sm"
              variant="outline"
              disabled={
                busy ||
                !!history.error ||
                !history.data ||
                page >= history.data.totalPages
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </AppButton>
          </div>
        </nav>
      </div>
    </section>
  );
}

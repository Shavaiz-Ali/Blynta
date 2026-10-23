"use client";
import { useState } from "react";
import {
  AppButton,
  AppSelect,
  AppTable,
  AppListEmptyState,
  recordListClasses,
} from "@blynta/ui";
import { Wallet } from "lucide-react";
import { useCreditHistory } from "../queries";
import {
  CREDIT_PRODUCT_OPTIONS,
  CREDIT_TYPE_OPTIONS,
  CREDIT_HISTORY_PAGE_SIZE,
} from "../constants";
import { CreditHistoryItem } from "./CreditHistoryItem";

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState("");
  const [type, setType] = useState("");
  const history = useCreditHistory(page, product, type);
  const rows = history.data?.rows ?? [];
  const busy = history.isFetching || history.isPending;
  const reset = () => {
    setProduct("");
    setType("");
    setPage(1);
  };
  return (
    <section aria-labelledby="credit-history" className="min-w-0 space-y-4">
      <h3 id="credit-history" className="sr-only">
        Credit usage history
      </h3>
      <div className={recordListClasses.toolbar}>
        <p className="text-xs text-muted-foreground">
          Credits added, held, spent and returned.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {[
            {
              label: "Filter by product",
              value: product,
              options: CREDIT_PRODUCT_OPTIONS,
              update: setProduct,
            },
            {
              label: "Filter by transaction type",
              value: type,
              options: CREDIT_TYPE_OPTIONS,
              update: setType,
            },
          ].map((filter) => (
            <AppSelect
              key={filter.label}
              aria-label={filter.label}
              value={filter.value || "all"}
              size="default"
              className="bg-background/80"
              wrapperClassName="w-full sm:w-44"
              options={filter.options}
              onValueChange={(value) => {
                const next = value === "all" ? "" : value;
                if (next === filter.value) return;
                filter.update(next);
                setPage(1);
              }}
            />
          ))}
          {(product || type) && (
            <AppButton
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              onClick={reset}
            >
              Reset
            </AppButton>
          )}
        </div>
      </div>
      <AppTable
        label="Credit transactions and recorded balance movements"
        data={rows}
        getRowKey={(entry) => entry._id}
        renderRow={(entry) => <CreditHistoryItem entry={entry} />}
        isLoading={history.isPending}
        loadingLabel="Loading credit history"
        isFetching={history.isFetching}
        errorState={
          history.error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive font-medium shadow-xs"
            >
              <p>Could not load credit history.</p>
              <AppButton
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => history.refetch()}
              >
                Try again
              </AppButton>
            </div>
          )
        }
        emptyState={
          <AppListEmptyState
            icon={<Wallet className="h-6 w-6 text-muted-foreground" />}
            title="No transactions match these filters."
            description="Credit grants, reservations and usage will appear here as they are recorded."
          >
            {(product || type) && (
              <AppButton size="sm" variant="outline" onClick={reset}>
                Clear filters
              </AppButton>
            )}
          </AppListEmptyState>
        }
        footer={
          <p className="text-xs text-muted-foreground">
            Holds reserve existing credits; releases restore availability. They
            are not new credit grants. Status describes the recorded
            transaction, not the current job status.
          </p>
        }
        pagination={
          history.data?.total
            ? {
                page,
                totalPages: history.data.totalPages,
                total: history.data.total,
                pageSize: CREDIT_HISTORY_PAGE_SIZE,
                visibleCount: rows.length,
                itemLabel: "transactions",
                disabled: busy || !!history.error,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </section>
  );
}

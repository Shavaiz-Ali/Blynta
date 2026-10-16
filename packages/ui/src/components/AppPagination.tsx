"use client";
import { AppButton } from "./AppButton";
import { AppSelect } from "./AppSelect";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AppPagination({
  page,
  totalPages,
  hasNext,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  variant = "default",
  itemLabel = "records",
  visibleCount,
}: {
  page: number;
  totalPages?: number;
  hasNext?: boolean;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  disabled?: boolean;
  /** Activity's compact range and page indicator presentation. */
  variant?: "default" | "activity";
  itemLabel?: string;
  visibleCount?: number;
}) {
  if (variant === "activity") {
    const pages = Math.max(1, totalPages ?? 1);
    const start = (page - 1) * (pageSize ?? 1) + 1;
    return (
      <nav
        aria-label="Pagination"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-6 border-t border-border/40"
      >
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {start}–
            {Math.min(start - 1 + (visibleCount ?? pageSize ?? 1), total ?? 0)}
          </span>{" "}
          of <span className="font-semibold text-foreground">{total}</span>{" "}
          {itemLabel}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <AppButton
            variant="outline"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            icon={<ChevronLeft className="h-3.5 w-3.5" />}
            iconPosition="left"
            className="h-8 text-xs font-medium px-3 whitespace-nowrap cursor-pointer shadow-2xs"
          >
            Previous
          </AppButton>
          <span
            aria-label={`Page ${page} of ${pages}`}
            className="text-xs font-mono font-medium text-foreground px-2.5 py-1 rounded-md bg-muted/60 border border-border/50 select-none"
          >
            {page} / {pages}
          </span>
          <AppButton
            variant="outline"
            size="sm"
            disabled={disabled || page >= pages}
            onClick={() => onPageChange(page + 1)}
            icon={<ChevronRight className="h-3.5 w-3.5" />}
            iconPosition="right"
            className="h-8 text-xs font-medium px-3 whitespace-nowrap cursor-pointer shadow-2xs"
          >
            Next
          </AppButton>
        </div>
      </nav>
    );
  }
  return (
    <nav
      aria-label="Pagination"
      className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span>
        {total !== undefined ? `${total.toLocaleString()} records` : ""}
      </span>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {onPageSizeChange && (
          <AppSelect
            aria-label="Rows per page"
            size="sm"
            wrapperClassName="w-20"
            value={String(pageSize)}
            disabled={disabled}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            options={[10, 25, 50, 100].map((n) => ({
              value: String(n),
              label: String(n),
            }))}
          />
        )}
        <AppButton
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </AppButton>
        <span className="whitespace-nowrap">
          Page {page}
          {totalPages !== undefined ? ` of ${Math.max(1, totalPages)}` : ""}
        </span>
        <AppButton
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            (totalPages !== undefined
              ? page >= Math.max(1, totalPages)
              : !hasNext)
          }
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </AppButton>
      </div>
    </nav>
  );
}

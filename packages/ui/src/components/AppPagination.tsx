"use client";
import { AppButton } from "./AppButton";
import { AppSelect } from "./AppSelect";

export function AppPagination({
  page,
  totalPages,
  hasNext,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: {
  page: number;
  totalPages?: number;
  hasNext?: boolean;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  disabled?: boolean;
}) {
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

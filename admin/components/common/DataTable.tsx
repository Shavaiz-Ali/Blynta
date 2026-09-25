"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AppButton } from "./AppButton";
import { AppSelect } from "./AppSelect";
import { AppSpinner } from "./AppSpinner";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
  };
  sorting?: {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  };
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = "No records found.",
  pagination,
  sorting,
  onRowClick,
}: DataTableProps<T>) {
  const handleSort = (columnKey: string) => {
    if (!sorting) return;
    if (sorting.sortBy === columnKey) {
      const nextOrder = sorting.sortOrder === "asc" ? "desc" : "asc";
      sorting.onSortChange(columnKey, nextOrder);
    } else {
      sorting.onSortChange(columnKey, "desc");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3.5",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && sorting && (
                      <span className="text-muted-foreground/70">
                        {sorting.sortBy === col.key ? (
                          sorting.sortOrder === "asc" ? (
                            <ArrowUp className="size-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="size-3.5 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: Math.min(5, pagination?.limit || 5) }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="px-4 py-4">
                      <div className="h-4 w-3/4 rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row.id || row._id || idx}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3.5 text-foreground align-middle", col.className)}>
                      {col.render ? col.render(row) : row[col.key] !== undefined ? String(row[col.key]) : "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground px-1">
          <div className="flex items-center gap-2">
            <span>
              Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </span>
            {pagination.onLimitChange && (
              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs">Per page:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => pagination.onLimitChange!(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-ring focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <AppButton
              variant="outline"
              size="icon-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => pagination.onPageChange(1)}
              title="First Page"
            >
              <ChevronsLeft className="size-3.5" />
            </AppButton>
            <AppButton
              variant="outline"
              size="icon-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              title="Previous Page"
            >
              <ChevronLeft className="size-3.5" />
            </AppButton>
            <span className="px-3 text-xs font-medium text-foreground">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <AppButton
              variant="outline"
              size="icon-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              title="Next Page"
            >
              <ChevronRight className="size-3.5" />
            </AppButton>
            <AppButton
              variant="outline"
              size="icon-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => pagination.onPageChange(pagination.totalPages)}
              title="Last Page"
            >
              <ChevronsRight className="size-3.5" />
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

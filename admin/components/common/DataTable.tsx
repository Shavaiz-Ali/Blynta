"use client";

import { isValidElement, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AppButton } from "./AppButton";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
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
    onSortChange: (key: string, order: "asc" | "desc") => void;
  };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, summary"));
}

function renderCellContent(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (isValidElement(value) || Array.isArray(value)) return value as ReactNode;

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const label = record.email ?? record.name ?? record.title ?? record.label ?? record.id ?? record._id;
    return typeof label === "string" || typeof label === "number" ? String(label) : "—";
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No records match these filters.",
  pagination,
  sorting,
  onRowClick,
}: DataTableProps<T>) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column.key));

  const openRow = (row: T, event: MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isInteractiveTarget(event.target)) return;
    onRowClick(row);
  };

  const openRowWithKeyboard = (row: T, event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className="min-w-0 space-y-3" aria-busy={loading}>
      <details className="w-fit text-sm">
        <summary className="cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Columns
        </summary>
        <div className="flex flex-wrap gap-4 py-3">
          {columns.map((column) => {
            const isVisible = !hiddenColumns.includes(column.key);
            return (
              <label key={column.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isVisible}
                  disabled={visibleColumns.length === 1 && isVisible}
                  onChange={(event) =>
                    setHiddenColumns((current) =>
                      event.target.checked
                        ? current.filter((key) => key !== column.key)
                        : [...current, column.key]
                    )
                  }
                />
                {column.header || "Actions"}
              </label>
            );
          })}
        </div>
      </details>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={column.className}
                  aria-sort={
                    sorting?.sortBy === column.key
                      ? sorting.sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column.sortable && sorting ? (
                    <AppButton
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        sorting.onSortChange(
                          column.key,
                          sorting.sortBy === column.key && sorting.sortOrder === "asc"
                            ? "desc"
                            : "asc"
                        )
                      }
                    >
                      {column.header}
                      <span aria-hidden="true">
                        {sorting.sortBy === column.key
                          ? sorting.sortOrder === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </AppButton>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length > 0 ? (
              data.map((row, index) => (
                <TableRow
                  key={row._id || row.id || index}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={(event) => openRow(row, event)}
                  onKeyDown={(event) => openRowWithKeyboard(row, event)}
                  className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none")}
                >
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {renderCellContent(
                        column.render
                          ? column.render(row)
                          : row[column.key as keyof T]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{pagination.total.toLocaleString()} records</span>
          <div className="flex flex-wrap items-center gap-3">
            {pagination.onLimitChange && (
              <label className="flex items-center gap-2">
                Rows
                <select
                  className="rounded-md border bg-background p-1"
                  value={pagination.limit}
                  onChange={(event) => pagination.onLimitChange?.(Number(event.target.value))}
                >
                  {[10, 25, 50, 100].map((limit) => <option key={limit}>{limit}</option>)}
                </select>
              </label>
            )}
            <AppButton variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>
              Previous
            </AppButton>
            <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
            <AppButton variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)}>
              Next
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable as AppDataTable };

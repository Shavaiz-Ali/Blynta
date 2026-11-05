"use client";

import {
  isValidElement,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AppButton, AppPagination, AppPopover, AppCheckbox } from "@blynta/ui";
import { Columns3, Inbox } from "lucide-react";
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
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, select, textarea, summary"))
  );
}

function renderCellContent(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (isValidElement(value) || Array.isArray(value)) return value as ReactNode;

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const label =
      record.email ??
      record.name ??
      record.title ??
      record.label ??
      record.id ??
      record._id;
    return typeof label === "string" || typeof label === "number"
      ? String(label)
      : "—";
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
  const visibleColumns = columns.filter(
    (column) => !hiddenColumns.includes(column.key),
  );

  const openRow = (row: T, event: MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isInteractiveTarget(event.target)) return;
    onRowClick(row);
  };

  const openRowWithKeyboard = (
    row: T,
    event: KeyboardEvent<HTMLTableRowElement>,
  ) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className="min-w-0 space-y-3" aria-busy={loading}>
      <div className="flex justify-end">
        <AppPopover
          title="Visible columns"
          trigger={
            <AppButton
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium shadow-2xs border-border/70 hover:bg-muted/60 cursor-pointer"
            >
              <Columns3 className="size-3.5 text-muted-foreground mr-1.5" />
              Columns
            </AppButton>
          }
        >
          <div className="grid gap-2.5 p-1">
            {columns.map((column) => {
              const isVisible = !hiddenColumns.includes(column.key);
              return (
                <AppCheckbox
                  key={column.key}
                  label={column.header || "Actions"}
                  checked={isVisible}
                  disabled={visibleColumns.length === 1 && isVisible}
                  onCheckedChange={(checked) =>
                    setHiddenColumns((current) =>
                      checked
                        ? current.filter((key) => key !== column.key)
                        : [...current, column.key],
                    )
                  }
                />
              );
            })}
          </div>
        </AppPopover>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs transition-colors">
        <Table className="w-full min-w-[760px] text-xs">
          <TableHeader className="bg-muted/40 border-b border-border/70">
            <TableRow className="hover:bg-transparent border-b border-border/70">
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "h-11 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground align-middle whitespace-nowrap",
                    column.className,
                  )}
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
                      className="-ml-2 h-7 px-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        sorting.onSortChange(
                          column.key,
                          sorting.sortBy === column.key &&
                            sorting.sortOrder === "asc"
                            ? "desc"
                            : "asc",
                        )
                      }
                    >
                      {column.header}
                      <span aria-hidden="true" className="ml-1 text-xs">
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
                <TableRow key={index} className="border-b border-border/50">
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key} className="px-5 py-4">
                      <Skeleton className="h-4 w-full rounded" />
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
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-muted/40",
                    onRowClick &&
                      "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none",
                  )}
                >
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "px-5 py-3.5 text-xs text-foreground align-middle whitespace-normal",
                        column.className,
                      )}
                    >
                      {renderCellContent(
                        column.render
                          ? column.render(row)
                          : row[column.key as keyof T],
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Inbox className="size-8 stroke-[1.5] text-muted-foreground/60" />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (pagination.total > 0 || pagination.page > 1) && (
        <div className="pt-2">
          <AppPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.limit}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onLimitChange}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}

export { DataTable as AppDataTable };

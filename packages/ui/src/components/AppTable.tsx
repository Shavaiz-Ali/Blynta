"use client";

import { Fragment, type Key, type ReactNode, type Ref } from "react";
import { AppCard } from "./AppCard";
import { AppListSkeleton } from "./AppListSkeleton";
import { AppListEmptyState } from "./AppListEmptyState";
import {
  AppTablePagination,
  type AppTablePaginationProps,
} from "./AppTablePagination";
import { recordListClasses } from "./list-presentation";
import { cn } from "../lib/utils";
import { List } from "lucide-react";

export interface AppTableProps<T> {
  data: readonly T[];
  getRowKey: (row: T) => Key;
  renderRow: (row: T) => ReactNode;
  label: string;
  isLoading?: boolean;
  isFetching?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
  loadingState?: ReactNode;
  errorState?: ReactNode;
  emptyState?: ReactNode;
  pagination?: AppTablePaginationProps;
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
}

/** Activity's record-list structure. Fetching, filters, routing and data stay in the feature. */
export function AppTable<T>({
  data,
  getRowKey,
  renderRow,
  label,
  isLoading,
  isFetching,
  disabled,
  loadingLabel = "Loading records",
  loadingState,
  errorState,
  emptyState = (
    <AppListEmptyState
      icon={<List className="h-6 w-6 text-muted-foreground" />}
      title="No records"
      description="There are no records to display."
    />
  ),
  pagination,
  footer,
  contentRef,
}: AppTableProps<T>) {
  if (isLoading)
    return loadingState ?? <AppListSkeleton label={loadingLabel} />;
  if (errorState) return errorState;
  return (
    <div
      className="space-y-4"
      ref={contentRef}
      role="region"
      aria-label={label}
      aria-busy={isFetching || undefined}
      inert={disabled || undefined}
    >
      <AppCard
        useDefaultClasses={false}
        className={cn(recordListClasses.container, isFetching && "opacity-60")}
        contentClassName="p-0 divide-y divide-border/30 w-full"
      >
        {data.length === 0
          ? emptyState
          : data.map((row) => (
              <Fragment key={getRowKey(row)}>{renderRow(row)}</Fragment>
            ))}
      </AppCard>
      {footer}
      {pagination && (
        <AppTablePagination
          {...pagination}
          disabled={disabled || pagination.disabled}
        />
      )}
    </div>
  );
}

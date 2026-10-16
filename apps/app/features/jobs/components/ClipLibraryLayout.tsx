"use client";
import type { ReactNode } from "react";
import {
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  AppTabs,
  AppViewModeToggle,
  type ViewMode,
  type AppTabItem,
} from "@blynta/ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@/features/dashboard/icons";

// The existing My Clips layout, shared with AI Studio rather than restyled per page.
export function LibraryCount({
  count,
  label,
}: {
  count?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
        {count ?? "—"} {label}
      </span>
    </div>
  );
}
export function LibraryHeading({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/60">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function LibraryToolbar({
  filter,
  onFilterChange,
  filters,
  search,
  onSearchChange,
  searchPlaceholder,
  sort,
  onSortChange,
  sortOptions,
  viewMode,
  onViewModeChange,
  maxSearchLength,
}: {
  filter: string;
  onFilterChange: (value: string) => void;
  filters: AppTabItem[];
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sort: string;
  onSortChange: (value: string) => void;
  sortOptions: { value: string; label: string }[];
  viewMode: ViewMode | null;
  onViewModeChange: (value: ViewMode) => void;
  maxSearchLength?: number;
}) {
  return (
    <AppCard
      className="py-0"
      contentClassName="flex-col gap-4 lg:flex-row lg:items-center"
      useDefaultClasses
    >
      <div className="min-w-0 flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
        <AppTabs
          value={filter}
          onValueChange={onFilterChange}
          tabs={filters}
          variant="default"
          size="default"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[200px] sm:min-w-[240px]">
          <AppInput
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder.replace(/\.+$|…$/g, "")}
            maxLength={maxSearchLength}
            size="default"
            prefixIcon={<SearchIcon className="h-3.5 w-3.5" />}
            className="bg-background/80"
          />
        </div>
        <div className="w-[140px]">
          <AppSelect
            value={sort}
            onValueChange={onSortChange}
            size="default"
            placeholder="Sort by"
            aria-label="Sort clips"
            className="bg-background/80"
            options={sortOptions}
          />
        </div>
        {viewMode !== null && (
          <AppViewModeToggle mode={viewMode} onChange={onViewModeChange} />
        )}
      </div>
    </AppCard>
  );
}
export function LibraryItems({
  viewMode,
  children,
  busy = false,
  disabled = false,
}: {
  viewMode: ViewMode;
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      aria-busy={busy}
      inert={disabled}
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
          : "space-y-2.5"
      }
    >
      {children}
    </div>
  );
}
export function LibraryPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (value: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <AppButton
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeftIcon className="h-4 w-4" />}
          className="h-8 px-3"
        >
          Prev
        </AppButton>
        <AppButton
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          icon={<ChevronRightIcon className="h-4 w-4" />}
          iconPosition="right"
          className="h-8 px-3"
        >
          Next
        </AppButton>
      </div>
    </div>
  );
}

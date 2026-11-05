"use client";
import { PLAN, PLAN_LABELS } from "@blynta/types";

import * as React from "react";
import { AppInput, AppButton, AppSelect } from "@blynta/ui";
import { SelectItem } from "@blynta/ui/primitives/select";
import { Search, X } from "lucide-react";
import { ListUsersParams, UserPlan } from "../types";

export interface UsersFilterBarProps {
  filters: ListUsersParams;
  onFilterChange: (filters: Partial<ListUsersParams>) => void;
  onReset: () => void;
}

export function UsersFilterBar({
  filters,
  onFilterChange,
  onReset,
}: UsersFilterBarProps) {
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.plan) ||
    filters.isActive !== undefined;

  return (
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-card rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs transition-colors">
      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="flex-1 min-w-0">
          <AppInput
            type="text"
            size="sm"
            placeholder="Search by name, email, referral code..."
            value={filters.search || ""}
            onChange={(e) =>
              onFilterChange({ search: e.target.value || undefined, page: 1 })
            }
            prefixIcon={<Search className="size-4" />}
          />
        </div>
        <AppButton type="submit" size="sm" className="w-full sm:w-auto font-semibold shadow-xs">
          Search
        </AppButton>
      </form>

      {/* Filters */}
      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        {/* Plan filter */}
        <AppSelect
          aria-label="Subscription plan"
          size="sm"
          wrapperClassName="w-full sm:w-40"
          value={filters.plan || "all"}
          onValueChange={(val) =>
            onFilterChange({
              plan: val === "all" ? undefined : (val as UserPlan),
              page: 1,
            })
          }
        >
          <SelectItem value="all">All Plans</SelectItem>
          <SelectItem value={PLAN.FREE}>{PLAN_LABELS[PLAN.FREE]}</SelectItem>
          <SelectItem value={PLAN.PRO}>{PLAN_LABELS[PLAN.PRO]}</SelectItem>
          <SelectItem value={PLAN.BUSINESS}>
            {PLAN_LABELS[PLAN.BUSINESS]}
          </SelectItem>
        </AppSelect>

        {/* Status filter */}
        <AppSelect
          aria-label="Account status"
          size="sm"
          wrapperClassName="w-full sm:w-40"
          value={
            filters.isActive === undefined
              ? "all"
              : filters.isActive
                ? "active"
                : "inactive"
          }
          onValueChange={(val) =>
            onFilterChange({
              isActive: val === "all" ? undefined : val === "active",
              page: 1,
            })
          }
        >
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </AppSelect>

        {hasActiveFilters && (
          <AppButton
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
            Clear
          </AppButton>
        )}
      </div>
    </div>
  );
}

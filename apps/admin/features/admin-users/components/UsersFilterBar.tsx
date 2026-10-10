"use client";

import * as React from "react";
import { AppInput as Input } from "@/components/common/primitives";
import { AppButton as Button } from "@/components/common/primitives";
import { AppSelect as Select } from "@blynta/ui";
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
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-card rounded-xl border border-border p-4 shadow-sm">
      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, email, referral code..."
            value={filters.search || ""}
            onChange={(e) =>
              onFilterChange({ search: e.target.value || undefined, page: 1 })
            }
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm" className="w-full sm:w-auto">
          Search
        </Button>
      </form>

      {/* Filters */}
      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        {/* Plan filter */}
        <Select
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
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="business">Business</SelectItem>
        </Select>

        {/* Status filter */}
        <Select
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
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { ListUsersParams, UserPlan } from "../types";

export interface UsersFilterBarProps {
  filters: ListUsersParams;
  onFilterChange: (filters: Partial<ListUsersParams>) => void;
  onReset: () => void;
}

export function UsersFilterBar({ filters, onFilterChange, onReset }: UsersFilterBarProps) {
  const [searchValue, setSearchValue] = React.useState(filters.search || "");

  React.useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ search: searchValue, page: 1 });
  };

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.plan) ||
    filters.isActive !== undefined;

  return (
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-card rounded-xl border border-border p-4 shadow-sm">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, email, referral code..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm">Search</Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Plan filter */}
        <Select
          value={filters.plan || "all"}
          onValueChange={(val) =>
            onFilterChange({ plan: val === "all" ? undefined : (val as UserPlan), page: 1 })
          }
        >
          <SelectTrigger size="sm" className="min-w-[110px]">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={
            filters.isActive === undefined ? "all" : filters.isActive ? "active" : "inactive"
          }
          onValueChange={(val) =>
            onFilterChange({
              isActive: val === "all" ? undefined : val === "active",
              page: 1,
            })
          }
        >
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
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

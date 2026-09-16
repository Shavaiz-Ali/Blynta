"use client";

import * as React from "react";
import { ActivityCategory, ActivityStatus } from "../types";
import { AppTabs, AppTabItem } from "@/components/common/AppTabs";
import { AppSelect } from "@/components/common/AppSelect";
import { AppInput } from "@/components/common/AppInput";
import { AppButton } from "@/components/common/AppButton";
import {
  ActivityIcon,
  FilmIcon,
  CoinsIcon,
  CreditCardIcon,
  UserIcon,
  UserPlusIcon,
  SearchIcon,
  RefreshCwIcon,
} from "@/features/dashboard/icons";

interface ActivityFilterBarProps {
  activeCategory?: ActivityCategory;
  onSelectCategory: (category?: ActivityCategory) => void;
  activeStatus?: ActivityStatus;
  onSelectStatus: (status?: ActivityStatus) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  isFiltered: boolean;
}

const CATEGORY_TABS: AppTabItem[] = [
  {
    value: "all",
    label: "All Activity",
    icon: <ActivityIcon className="h-3.5 w-3.5" />,
  },
  {
    value: ActivityCategory.JOB,
    label: "Video Jobs",
    icon: <FilmIcon className="h-3.5 w-3.5" />,
  },
  {
    value: ActivityCategory.CREDIT,
    label: "Credits",
    icon: <CoinsIcon className="h-3.5 w-3.5" />,
  },
  {
    value: ActivityCategory.BILLING,
    label: "Billing",
    icon: <CreditCardIcon className="h-3.5 w-3.5" />,
  },
  {
    value: ActivityCategory.ACCOUNT,
    label: "Account & Auth",
    icon: <UserIcon className="h-3.5 w-3.5" />,
  },
  {
    value: ActivityCategory.REFERRAL,
    label: "Referrals",
    icon: <UserPlusIcon className="h-3.5 w-3.5" />,
  },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: ActivityStatus.SUCCESS, label: "Success" },
  { value: ActivityStatus.PENDING, label: "In Progress" },
  { value: ActivityStatus.FAILED, label: "Failed" },
  { value: ActivityStatus.CANCELLED, label: "Cancelled" },
];

export function ActivityFilterBar({
  activeCategory,
  onSelectCategory,
  activeStatus,
  onSelectStatus,
  searchQuery,
  onSearchChange,
  onResetFilters,
  isFiltered,
}: ActivityFilterBarProps) {
  const currentCategoryValue = activeCategory ?? "all";
  const currentStatusValue = activeStatus ?? "all";

  const handleTabChange = (val: string) => {
    if (val === "all") {
      onSelectCategory(undefined);
    } else {
      onSelectCategory(val as ActivityCategory);
    }
  };

  const handleStatusChange = (val: string) => {
    if (val === "all") {
      onSelectStatus(undefined);
    } else {
      onSelectStatus(val as ActivityStatus);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 p-3 sm:p-3.5 rounded-lg border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
      {/* ── Category Navigation Tabs using AppTabs ── */}
      <div className="overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
        <AppTabs
          value={currentCategoryValue}
          onValueChange={handleTabChange}
          tabs={CATEGORY_TABS}
          variant="default"
          size="default"
          className="w-full sm:w-auto"
        />
      </div>

      {/* ── Search, Status & Clear Controls ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="min-w-[200px] sm:min-w-[240px] flex-1 sm:flex-initial">
          <AppInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by action, keyword..."
            size="default"
            prefixIcon={<SearchIcon className="h-3.5 w-3.5" />}
            className="bg-background/80"
          />
        </div>

        {/* Status Select */}
        <div className="w-[140px]">
          <AppSelect
            value={currentStatusValue}
            onValueChange={handleStatusChange}
            size="default"
            options={STATUS_OPTIONS}
            className="bg-background/80"
          />
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <AppButton
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            icon={<RefreshCwIcon className="h-3.5 w-3.5" />}
          >
            Reset
          </AppButton>
        )}
      </div>
    </div>
  );
}

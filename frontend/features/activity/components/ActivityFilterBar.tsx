"use client";

import * as React from "react";
import { ActivityCategory, ActivityStatus } from "../types";
import { cn } from "@/lib/utils";

interface ActivityFilterBarProps {
  activeCategory?: ActivityCategory;
  onSelectCategory: (category?: ActivityCategory) => void;
  activeStatus?: ActivityStatus;
  onSelectStatus: (status?: ActivityStatus) => void;
}

const CATEGORY_TABS: { label: string; value?: ActivityCategory }[] = [
  { label: "All Activity", value: undefined },
  { label: "Video Jobs", value: ActivityCategory.JOB },
  { label: "Credits", value: ActivityCategory.CREDIT },
  { label: "Billing", value: ActivityCategory.BILLING },
  { label: "Account & Auth", value: ActivityCategory.ACCOUNT },
  { label: "Referrals", value: ActivityCategory.REFERRAL },
];

const STATUS_TABS: { label: string; value?: ActivityStatus }[] = [
  { label: "All Status", value: undefined },
  { label: "Success", value: ActivityStatus.SUCCESS },
  { label: "In Progress", value: ActivityStatus.PENDING },
  { label: "Failed", value: ActivityStatus.FAILED },
];

export function ActivityFilterBar({
  activeCategory,
  onSelectCategory,
  activeStatus,
  onSelectStatus,
}: ActivityFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 border border-border/40 p-2 rounded-2xl">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeCategory === tab.value;
          return (
            <button
              key={tab.label}
              onClick={() => onSelectCategory(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status Filter Select */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <select
          value={activeStatus ?? ""}
          onChange={(e) =>
            onSelectStatus(
              e.target.value ? (e.target.value as ActivityStatus) : undefined
            )
          }
          className="h-8 rounded-xl border border-border/50 bg-background/80 px-2.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_TABS.map((tab) => (
            <option key={tab.label} value={tab.value ?? ""}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

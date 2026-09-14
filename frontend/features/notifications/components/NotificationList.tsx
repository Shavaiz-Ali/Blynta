"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AppButton } from "@/components/common/AppButton";
import {
  NotificationItem,
  NotificationItemSeparator,
  NotificationItemSkeleton,
} from "./NotificationItem";
import { EmptyState } from "./EmptyState";
import {
  useNotificationsQuery,
} from "../queries";
import type {
  ListNotificationsOptions,
} from "../types";
import { NotificationCategory } from "../types";

/* -------------------------------------------------------------------------- */
/*                              NotificationList                              */
/* -------------------------------------------------------------------------- */

export interface NotificationListProps {
  /** Query filter options (page, limit, status, category). */
  options?: ListNotificationsOptions;
  /** Max items to fetch. @default 20 */
  limit?: number;
  /** Compact mode for the dropdown. */
  compact?: boolean;
  /** Show hover actions (mark-read, delete) on each item. */
  showActions?: boolean;
  /** Max height for the scroll area. Pass `"none"` to disable. */
  maxHeight?: string;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Called when a notification action (click/navigate) occurs. */
  onNotificationAction?: () => void;
}

export function NotificationList({
  options,
  limit = 20,
  compact = false,
  showActions = true,
  maxHeight = "380px",
  className,
  onNotificationAction,
}: NotificationListProps) {
  const { data, isLoading, isError, refetch } = useNotificationsQuery({
    limit,
    ...options,
  });

  const notifications = data?.notifications ?? [];

  if (isLoading) {
    return (
      <div className={cn("space-y-0.5", className)}>
        {Array.from({ length: compact ? 4 : 5 }).map((_, i) => (
          <NotificationItemSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex-1 flex flex-col justify-center", className)}>
        <EmptyState
          compact={compact}
          title="Couldn't load notifications"
          description="Please try again in a moment."
          action={
            <AppButton
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => refetch()}
            >
              Retry
            </AppButton>
          }
        />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={cn("flex-1 flex flex-col justify-center", className)}>
        <EmptyState
          compact={compact}
          title="No notifications yet"
          description="We'll let you know when something needs your attention."
        />
      </div>
    );
  }

  const content = (
    <div className="space-y-0.5">
      {notifications.map((n, i) => (
        <React.Fragment key={n._id}>
          <NotificationItem
            notification={n}
            compact={compact}
            showActions={showActions}
            onAction={onNotificationAction}
          />
          {i < notifications.length - 1 && <NotificationItemSeparator />}
        </React.Fragment>
      ))}
    </div>
  );

  if (maxHeight === "none") {
    return <div className={className}>{content}</div>;
  }

  return (
    <ScrollArea className={cn(className)} style={{ maxHeight }}>
      {content}
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}

/* -------------------------------------------------------------------------- */
/*                           NotificationCategoryTabs                         */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_CATEGORY_TABS = [
  { value: "all", label: "All" },
  { value: NotificationCategory.JOB, label: "Jobs" },
  { value: NotificationCategory.BILLING, label: "Billing" },
  { value: NotificationCategory.SYSTEM, label: "System" },
] as const;

export type NotificationCategoryTabValue =
  (typeof NOTIFICATION_CATEGORY_TABS)[number]["value"];

export interface NotificationCategoryTabsProps {
  value: NotificationCategoryTabValue;
  onChange: (value: NotificationCategoryTabValue) => void;
  className?: string;
}

export function NotificationCategoryTabs({
  value,
  onChange,
  className,
}: NotificationCategoryTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5",
        className
      )}
    >
      {NOTIFICATION_CATEGORY_TABS.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              isActive
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           helper: tab to filter option                    */
/* -------------------------------------------------------------------------- */

export function categoryTabToFilter(
  tab: NotificationCategoryTabValue
): NotificationCategory | undefined {
  if (tab === "all") return undefined;
  return tab as NotificationCategory;
}

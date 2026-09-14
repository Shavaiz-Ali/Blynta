"use client";

import * as React from "react";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppTabs, AppTabItem } from "@/components/common/AppTabs";
import { Badge } from "@/components/ui/badge";
import {
  BellIcon,
  CheckCheckIcon,
} from "./icons";
import {
  NotificationList,
  NotificationCategoryTabs,
  NotificationCategoryTabValue,
  categoryTabToFilter,
} from "./NotificationList";
import {
  useMarkAllAsReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "../queries";
import { NotificationStatus } from "../types";

export function NotificationsPage() {
  const { data: profile } = useCurrentUser();
  const [filterType, setFilterType] = React.useState<"all" | "unread">("all");
  const [categoryTab, setCategoryTab] =
    React.useState<NotificationCategoryTabValue>("all");
  const [page, setPage] = React.useState(1);
  const limit = 15;

  const { data: unreadData } = useUnreadCountQuery();
  const unreadCount = unreadData?.count ?? 0;
  const hasUnread = unreadCount > 0;

  const markAllAsRead = useMarkAllAsReadMutation();

  // Reset page to 1 when filters change
  const handleFilterChange = (val: string) => {
    setFilterType(val as "all" | "unread");
    setPage(1);
  };

  const handleCategoryChange = (val: NotificationCategoryTabValue) => {
    setCategoryTab(val);
    setPage(1);
  };

  const selectedCategory = categoryTabToFilter(categoryTab);
  const selectedStatus =
    filterType === "unread" ? NotificationStatus.UNREAD : undefined;

  // Query notifications to get pagination info
  const { data, isLoading } = useNotificationsQuery({
    page,
    limit,
    status: selectedStatus,
    category: selectedCategory,
  });

  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleMarkAll = () => {
    markAllAsRead.mutate();
  };

  const tabs: AppTabItem[] = [
    {
      value: "all",
      label: "All Notifications",
    },
    {
      value: "unread",
      label: "Unread",
      badge: hasUnread ? (
        <Badge
          variant="default"
          className="ml-1.5 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      ) : undefined,
    },
  ];

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium text-foreground">Notifications</h1>
        {hasUnread && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-semibold">
            {unreadCount} unread
          </span>
        )}
      </div>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Page Header & Quick Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <BellIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Notifications
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Stay up to date with your clips, rendering jobs, and account activity.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={!hasUnread || markAllAsRead.isPending}
              icon={<CheckCheckIcon className="h-3.5 w-3.5" />}
              className="text-xs font-medium border-border/70 hover:bg-muted/60"
            >
              Mark all as read
            </AppButton>
          </div>
        </div>

        {/* ── Filters & Category Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-border/60">
          <AppTabs
            value={filterType}
            onValueChange={handleFilterChange}
            tabs={tabs}
            variant="line"
            size="sm"
          />

          <div className="flex items-center gap-2">
            <NotificationCategoryTabs
              value={categoryTab}
              onChange={handleCategoryChange}
              className="w-full sm:w-auto"
            />
          </div>
        </div>

        {/* ── Notifications Content Container ── */}
        <div className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-sm shadow-xs p-2 sm:p-4 min-h-[400px]">
          <NotificationList
            options={{
              page,
              limit,
              status: selectedStatus,
              category: selectedCategory,
            }}
            limit={limit}
            compact={false}
            showActions={true}
            maxHeight="none"
          />

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between px-2 text-xs">
              <span className="text-muted-foreground">
                Showing {((page - 1) * limit) + 1}–
                {Math.min(page * limit, totalItems)} of {totalItems}
              </span>

              <div className="flex items-center gap-1.5">
                <AppButton
                  variant="outline"
                  size="xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="h-7 px-2.5 text-xs"
                >
                  Previous
                </AppButton>
                <span className="px-2 text-xs font-medium text-foreground">
                  {page} / {totalPages}
                </span>
                <AppButton
                  variant="outline"
                  size="xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="h-7 px-2.5 text-xs"
                >
                  Next
                </AppButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

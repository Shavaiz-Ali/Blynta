"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { NotificationList } from "./NotificationList";
import { useUnreadCountQuery } from "../queries";

/* -------------------------------------------------------------------------- */
/*                            NotificationDropdown                            */
/* -------------------------------------------------------------------------- */

export interface NotificationDropdownProps {
  /** Called when the dropdown should close (e.g. after navigating). */
  onClose?: () => void;
  className?: string;
}

/**
 * Clean notification dropdown box with expanded height.
 */
export function NotificationDropdown({
  onClose,
  className,
}: NotificationDropdownProps) {
  const { data: unreadData } = useUnreadCountQuery();

  const unreadCount = unreadData?.count ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col w-[350px] sm:w-[380px] min-h-[260px] sm:min-h-[280px] max-h-[420px] max-w-[calc(100vw-2rem)] select-none bg-card text-card-foreground",
        className
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            Notifications
          </h3>
          {hasUnread && (
            <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary/15 text-primary border border-primary/25 px-1.5 text-[10px] font-bold tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px w-full bg-border/70 shrink-0" />

      {/* ── Body — expanded notification list ── */}
      <div className="flex-1 flex flex-col p-1.5 overflow-y-auto min-h-0">
        <NotificationList
          limit={10}
          compact
          showActions={false}
          maxHeight="none"
          className="flex-1 flex flex-col"
          onNotificationAction={onClose}
        />
      </div>
    </div>
  );
}

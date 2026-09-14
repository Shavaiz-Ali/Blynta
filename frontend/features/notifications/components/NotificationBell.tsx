"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AppButton } from "@/components/common/AppButton";
import { AppPopover } from "@/components/common/AppPopover";
import { BellIcon } from "./icons";
import { NotificationDropdown } from "./NotificationDropdown";
import { useUnreadCountQuery } from "../queries";

export interface NotificationBellProps {
  className?: string;
}

/**
 * Self-contained notification bell button with unread count badge
 * and dropdown popover for the dashboard header.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = React.useState(false);
  const { data: unreadData } = useUnreadCountQuery();

  const unreadCount = unreadData?.count ?? 0;
  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <AppPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      contentClassName="shadow-2xl overflow-hidden rounded-xl"
      trigger={
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            open && "bg-muted/70 text-foreground",
            className
          )}
          aria-label={
            hasUnread
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          title="Notifications"
        >
          <BellIcon className="h-4 w-4" />
          {hasUnread && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground tabular-nums shadow-xs animate-in zoom-in-50 duration-200",
                unreadCount > 9
                  ? "h-4 min-w-4 px-1 text-[9px]"
                  : "h-3.5 w-3.5 text-[9px]"
              )}
            >
              {displayCount}
            </span>
          )}
        </AppButton>
      }
    >
      <NotificationDropdown onClose={() => setOpen(false)} />
    </AppPopover>
  );
}

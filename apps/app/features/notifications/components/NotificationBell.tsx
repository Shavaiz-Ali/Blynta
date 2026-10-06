"use client";
import { useState } from "react";
import { AppNotificationControl } from "@blynta/ui";
import { NotificationDropdown } from "./NotificationDropdown";
import { useUnreadCountQuery } from "../queries";
export interface NotificationBellProps {
  className?: string;
}
export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { data } = useUnreadCountQuery();
  return (
    <AppNotificationControl
      unreadCount={data?.count}
      open={open}
      onOpenChange={setOpen}
      className={className}
    >
      <NotificationDropdown onClose={() => setOpen(false)} />
    </AppNotificationControl>
  );
}

"use client";
import Link from "next/link";
import {
  AppHeaderActions,
  AppCreditsControl,
  AppNotificationControl,
} from "@blynta/ui";
import { UserDropdown } from "@/components/common/UserDropdown";
import { blyntaUrl } from "@/config/env";
import {
  useWorkspaceQuery,
  type AccountProfile,
  type NotificationPage,
} from "../workspace-api";

export function AccountControls() {
  const profile = useWorkspaceQuery<AccountProfile>("users/me");
  const unread = useWorkspaceQuery<{ count: number }>(
    "notifications/unread-count",
  );
  const notifications = useWorkspaceQuery<NotificationPage>(
    "notifications?limit=5",
  );
  return (
    <AppHeaderActions
      credits={
        <AppCreditsControl
          balance={profile.data?.creditsBalance}
          plan={profile.data?.plan}
          resetAt={profile.data?.creditsResetAt}
          error={profile.error?.message}
          usageLink={<Link href="/usage" />}
          billingLink={
            blyntaUrl ? (
              <a href={`${blyntaUrl.replace(/\/$/, "")}/billing`} />
            ) : undefined
          }
        />
      }
      account={<UserDropdown />}
      notifications={
        <AppNotificationControl unreadCount={unread.data?.count}>
          <div className="w-[350px] sm:w-[380px] max-w-[calc(100vw-2rem)]">
            <div className="border-b px-4 py-3 text-sm font-semibold">
              Notifications
            </div>
            <div className="max-h-72 overflow-y-auto p-3 space-y-3">
              {notifications.isPending && (
                <p className="text-xs text-muted-foreground">
                  Loading notifications…
                </p>
              )}
              {notifications.error && (
                <p role="alert" className="text-xs text-destructive">
                  {notifications.error.message}
                </p>
              )}
              {notifications.data?.notifications.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  You’re all caught up.
                </p>
              )}
              {notifications.data?.notifications.map((n) => (
                <div key={n._id} className="text-xs">
                  <p className="font-semibold">
                    {n.status === "unread" && (
                      <span className="text-primary">● </span>
                    )}
                    {n.title}
                  </p>
                  <p className="text-muted-foreground mt-1">{n.message}</p>
                  <time
                    className="text-muted-foreground text-[10px]"
                    dateTime={n.createdAt}
                  >
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
            <Link
              href="/notifications"
              className="block border-t p-3 text-xs font-medium hover:bg-muted"
            >
              View all notifications
            </Link>
          </div>
        </AppNotificationControl>
      }
    />
  );
}

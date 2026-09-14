"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  TrashIcon,
  XCircleIcon,
} from "./icons";
import {
  NotificationCategory,
  Notification as NotificationType,
  NotificationStatus,
  NotificationType as NotificationTypeEnum,
} from "../types";
import {
  useDeleteNotificationMutation,
  useMarkAsReadMutation,
} from "../queries";

/* -------------------------------------------------------------------------- */
/*                              Type-to-icon map                              */
/* -------------------------------------------------------------------------- */

function TypeIcon({ type, className }: { type: NotificationTypeEnum; className?: string }) {
  switch (type) {
    case NotificationTypeEnum.SUCCESS:
      return <CheckCircleIcon className={cn("text-emerald-500", className)} />;
    case NotificationTypeEnum.ERROR:
      return <XCircleIcon className={cn("text-destructive", className)} />;
    case NotificationTypeEnum.WARNING:
      return <AlertTriangleIcon className={cn("text-amber-500", className)} />;
    case NotificationTypeEnum.INFO:
    default:
      return <InfoIcon className={cn("text-sky-500", className)} />;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Category badge variant                          */
/* -------------------------------------------------------------------------- */

function categoryBadgeVariant(category: NotificationCategory): "default" | "secondary" | "outline" {
  switch (category) {
    case NotificationCategory.JOB:
      return "default";
    case NotificationCategory.BILLING:
    case NotificationCategory.CREDIT:
      return "secondary";
    default:
      return "outline";
  }
}

/* -------------------------------------------------------------------------- */
/*                             Relative time helper                           */
/* -------------------------------------------------------------------------- */

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

/* -------------------------------------------------------------------------- */
/*                              NotificationItem                              */
/* -------------------------------------------------------------------------- */

export interface NotificationItemProps {
  notification: NotificationType;
  /** Compact mode for dropdown use. Full mode for the dedicated page. */
  compact?: boolean;
  /** Show delete / mark-read hover actions. */
  showActions?: boolean;
  className?: string;
  /** Called after an action link is clicked or navigation occurs. */
  onAction?: () => void;
}

export function NotificationItem({
  notification,
  compact = false,
  showActions = true,
  className,
  onAction,
}: NotificationItemProps) {
  const router = useRouter();
  const isUnread = notification.status === NotificationStatus.UNREAD;

  const markAsRead = useMarkAsReadMutation();
  const deleteNotif = useDeleteNotificationMutation();

  const handleMarkRead = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isUnread) {
        markAsRead.mutate(notification._id);
      }
    },
    [isUnread, markAsRead, notification._id]
  );

  const handleDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNotif.mutate(notification._id);
    },
    [deleteNotif, notification._id]
  );

  /**
   * Clicking the notification row:
   * 1. Optimistically mark as read (fire-and-forget)
   * 2. Navigate to actionUrl if present
   * 3. Call onAction callback (e.g. to close dropdown)
   */
  const handleRowClick = React.useCallback(() => {
    if (isUnread) {
      markAsRead.mutate(notification._id);
    }

    if (notification.actionUrl) {
      if (notification.actionUrl.startsWith("http")) {
        window.open(notification.actionUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(notification.actionUrl);
      }
    }

    onAction?.();
  }, [isUnread, markAsRead, notification, router, onAction]);

  const actionHref = notification.actionUrl;
  const hasAction = Boolean(actionHref && notification.actionLabel);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        "group relative flex gap-3 rounded-lg transition-colors cursor-pointer",
        compact ? "p-2.5" : "p-3",
        isUnread
          ? "bg-muted/40 hover:bg-muted/60"
          : "hover:bg-muted/30",
        className
      )}
    >
      {/* Unread dot */}
      {isUnread && (
        <span
          className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}

      {/* Icon */}
      <div className="shrink-0 pt-0.5 pl-1">
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-border/80 bg-background shadow-xs",
            compact ? "h-7 w-7" : "h-8 w-8",
            isUnread && "ring-1 ring-primary/20"
          )}
        >
          <TypeIcon type={notification.type} className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4
              className={cn(
                "truncate text-xs font-semibold text-foreground",
                !isUnread && "text-foreground/80 font-medium"
              )}
            >
              {notification.title}
            </h4>
            {!compact && (
              <Badge
                variant={categoryBadgeVariant(notification.category)}
                className="h-4 px-1.5 text-[9px] uppercase tracking-wider font-bold shrink-0"
              >
                {notification.category.toLowerCase()}
              </Badge>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums pt-0.5">
            {timeAgo(notification.createdAt)}
          </span>
        </div>

        <p
          className={cn(
            "text-xs leading-relaxed text-muted-foreground",
            compact ? "line-clamp-1" : "line-clamp-2",
            isUnread && "text-foreground/70"
          )}
        >
          {notification.message}
        </p>

        {hasAction && actionHref && !compact && (
          <div className="pt-0.5">
            {actionHref.startsWith("http") ? (
              <a
                href={actionHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                {notification.actionLabel}
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            ) : (
              <Link
                href={actionHref}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                {notification.actionLabel}
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Actions — visible on hover */}
      {showActions && (
        <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isUnread && (
            <button
              type="button"
              onClick={handleMarkRead}
              disabled={markAsRead.isPending}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="Mark as read"
              aria-label="Mark as read"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteNotif.isPending}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            title="Delete notification"
            aria-label="Delete notification"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           NotificationItemSeparator                        */
/* -------------------------------------------------------------------------- */

export function NotificationItemSeparator() {
  return <div className="h-px w-full bg-border/50 shrink-0 my-0.5" />;
}

/* -------------------------------------------------------------------------- */
/*                             NotificationItemSkeleton                       */
/* -------------------------------------------------------------------------- */

export function NotificationItemSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg", compact ? "p-2.5" : "p-3", className)}>
      <div className="shrink-0 pl-1 pt-0.5">
        <div className={cn("rounded-full bg-muted animate-pulse", compact ? "h-7 w-7" : "h-8 w-8")} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          <div className="h-2 w-10 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="h-2 w-full rounded bg-muted animate-pulse" />
          {!compact && <div className="h-2 w-2/3 rounded bg-muted animate-pulse" />}
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AppButton } from "@/components/common/AppButton";
import {
  FilmIcon,
  CreditCardIcon,
  UserIcon,
  SparklesIcon,
  KeyRoundIcon,
  CoinsIcon,
  UserPlusIcon,
  ArrowRightIcon,
  DownloadIcon,
  Trash2Icon,
  ShieldIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "@/features/dashboard/icons";
import {
  Activity,
  ActivityCategory,
  ActivityStatus,
  ActivityType,
} from "../types";
import { cn } from "@/lib/utils";

interface ActivityItemProps {
  activity: Activity;
}

function getActivityIcon(activity: Activity) {
  switch (activity.category) {
    case ActivityCategory.JOB:
      if (activity.type === ActivityType.CLIP_DOWNLOAD) {
        return <DownloadIcon className="h-4 w-4 text-emerald-500" />;
      }
      if (activity.type === ActivityType.CLIP_DELETE || activity.type === ActivityType.JOB_DELETE) {
        return <Trash2Icon className="h-4 w-4 text-rose-500" />;
      }
      if (activity.type === ActivityType.JOB_COMPLETE) {
        return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
      }
      if (activity.type === ActivityType.JOB_FAIL) {
        return <AlertTriangleIcon className="h-4 w-4 text-rose-500" />;
      }
      return <FilmIcon className="h-4 w-4 text-primary" />;

    case ActivityCategory.CREDIT:
      if (activity.type === ActivityType.CREDIT_DEDUCT) {
        return <CoinsIcon className="h-4 w-4 text-amber-500" />;
      }
      return <SparklesIcon className="h-4 w-4 text-indigo-500" />;

    case ActivityCategory.BILLING:
      return <CreditCardIcon className="h-4 w-4 text-violet-500" />;

    case ActivityCategory.REFERRAL:
      return <UserPlusIcon className="h-4 w-4 text-pink-500" />;

    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      if (activity.type === ActivityType.AUTH_PASSWORD_CHANGE || activity.type === ActivityType.AUTH_PASSWORD_RESET_COMPLETE) {
        return <KeyRoundIcon className="h-4 w-4 text-amber-500" />;
      }
      return <UserIcon className="h-4 w-4 text-blue-500" />;

    default:
      return <ShieldIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function getCategoryBadge(category: ActivityCategory) {
  switch (category) {
    case ActivityCategory.JOB:
      return <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium">Job</Badge>;
    case ActivityCategory.CREDIT:
      return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-medium">Credits</Badge>;
    case ActivityCategory.BILLING:
      return <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[11px] font-medium">Billing</Badge>;
    case ActivityCategory.REFERRAL:
      return <Badge variant="secondary" className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 text-[11px] font-medium">Referral</Badge>;
    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px] font-medium">Account</Badge>;
    default:
      return <Badge variant="secondary" className="text-[11px]">System</Badge>;
  }
}

function getStatusIndicator(status: ActivityStatus) {
  switch (status) {
    case ActivityStatus.SUCCESS:
      return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Success" />;
    case ActivityStatus.PENDING:
      return <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="In Progress" />;
    case ActivityStatus.FAILED:
      return <span className="inline-block w-2 h-2 rounded-full bg-rose-500" title="Failed" />;
    case ActivityStatus.CANCELLED:
      return <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" title="Cancelled" />;
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasMetadata = Boolean(activity.metadata && Object.keys(activity.metadata).length > 0);

  return (
    <div
      className={cn(
        "group p-4 transition-all duration-150 hover:bg-muted/30 border-b border-border/30 last:border-b-0",
        isExpanded && "bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Icon and Details */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center shrink-0 shadow-sm">
            {getActivityIcon(activity)}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate max-w-sm sm:max-w-md">
                {activity.title}
              </span>
              {getCategoryBadge(activity.category)}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {getStatusIndicator(activity.status)}
              </span>
            </div>

            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {activity.description}
              </p>
            )}

            {/* Quick Metadata preview tags */}
            {activity.metadata && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {activity.metadata.amount !== undefined && (
                  <span className="inline-flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {activity.metadata.amount} {activity.metadata.amount === 1 ? 'credit' : 'credits'}
                  </span>
                )}
                {activity.metadata.clipCount !== undefined && (
                  <span className="inline-flex items-center text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {activity.metadata.clipCount} {activity.metadata.clipCount === 1 ? 'clip' : 'clips'}
                  </span>
                )}
                {activity.metadata.plan && (
                  <span className="inline-flex items-center text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                    Plan: {String(activity.metadata.plan).toUpperCase()}
                  </span>
                )}
                {activity.metadata.sourcePlatform && (
                  <span className="inline-flex items-center text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                    Platform: {String(activity.metadata.sourcePlatform)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timestamp and Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="text-xs text-muted-foreground hidden sm:inline-block font-mono"
            title={new Date(activity.createdAt).toLocaleString()}
          >
            {formatRelativeTime(activity.createdAt)}
          </span>

          {activity.activityUrl && (
            <Link href={activity.activityUrl}>
              <AppButton
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5 hover:border-primary/40 hover:bg-primary/5"
              >
                <span>View</span>
                <ArrowRightIcon className="h-3.5 w-3.5 opacity-70" />
              </AppButton>
            </Link>
          )}

          {hasMetadata && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted ml-1 transition-colors"
              title="Toggle details"
            >
              {isExpanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Metadata Inspector */}
      {isExpanded && hasMetadata && (
        <div className="mt-3 pt-3 border-t border-border/20 pl-13">
          <div className="rounded-lg bg-muted/40 border border-border/30 p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto space-y-1">
            <div className="text-foreground font-semibold text-[11px] mb-1">Event Payload & Metadata:</div>
            {Object.entries(activity.metadata || {}).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-primary/90 font-medium">{key}:</span>
                <span className="text-foreground">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
            {activity.entityType && (
              <div className="flex items-center gap-2">
                <span className="text-primary/90 font-medium">entity:</span>
                <span className="text-foreground">{activity.entityType} ({activity.entityId || 'none'})</span>
              </div>
            )}
            {activity.ipAddress && (
              <div className="flex items-center gap-2">
                <span className="text-primary/90 font-medium">clientIp:</span>
                <span className="text-foreground">{activity.ipAddress}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

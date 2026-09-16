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
  CheckIcon,
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
      if (
        activity.type === ActivityType.CLIP_DELETE ||
        activity.type === ActivityType.JOB_DELETE
      ) {
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
      if (
        activity.type === ActivityType.AUTH_PASSWORD_CHANGE ||
        activity.type === ActivityType.AUTH_PASSWORD_RESET_COMPLETE
      ) {
        return <KeyRoundIcon className="h-4 w-4 text-amber-500" />;
      }
      return <UserIcon className="h-4 w-4 text-sky-500" />;

    default:
      return <ShieldIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function getActivityIconContainerClass(category: ActivityCategory) {
  switch (category) {
    case ActivityCategory.JOB:
      return "bg-primary/10 text-primary border-primary/25";
    case ActivityCategory.CREDIT:
      return "bg-amber-500/10 text-amber-500 border-amber-500/25";
    case ActivityCategory.BILLING:
      return "bg-violet-500/10 text-violet-500 border-violet-500/25";
    case ActivityCategory.REFERRAL:
      return "bg-pink-500/10 text-pink-500 border-pink-500/25";
    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      return "bg-sky-500/10 text-sky-500 border-sky-500/25";
    default:
      return "bg-muted text-muted-foreground border-border/70";
  }
}

function getCategoryBadge(category: ActivityCategory) {
  switch (category) {
    case ActivityCategory.JOB:
      return (
        <Badge
          variant="secondary"
          className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium"
        >
          Job
        </Badge>
      );
    case ActivityCategory.CREDIT:
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-medium"
        >
          Credits
        </Badge>
      );
    case ActivityCategory.BILLING:
      return (
        <Badge
          variant="secondary"
          className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[11px] font-medium"
        >
          Billing
        </Badge>
      );
    case ActivityCategory.REFERRAL:
      return (
        <Badge
          variant="secondary"
          className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 text-[11px] font-medium"
        >
          Referral
        </Badge>
      );
    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      return (
        <Badge
          variant="secondary"
          className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[11px] font-medium"
        >
          Account
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground border-border/60 text-[11px] font-medium"
        >
          System
        </Badge>
      );
  }
}

function getStatusIndicator(status: ActivityStatus) {
  switch (status) {
    case ActivityStatus.SUCCESS:
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          <span>Success</span>
        </span>
      );
    case ActivityStatus.PENDING:
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          <span>Processing</span>
        </span>
      );
    case ActivityStatus.FAILED:
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
          <span>Failed</span>
        </span>
      );
    case ActivityStatus.CANCELLED:
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
          <span>Cancelled</span>
        </span>
      );
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
  const [copied, setCopied] = React.useState(false);
  const hasMetadata = Boolean(
    activity.metadata && Object.keys(activity.metadata).length > 0
  );

  // Only show a navigation action if it's a specific Job or Billing with an actual dedicated page (and not generic dashboard / home page)
  const isDedicatedJob =
    activity.category === ActivityCategory.JOB &&
    Boolean(activity.entityId || (activity.activityUrl && activity.activityUrl.startsWith("/jobs/")));
  const isBillingAction =
    activity.category === ActivityCategory.BILLING &&
    activity.activityUrl === "/billing";

  const targetUrl = isDedicatedJob
    ? activity.entityId
      ? `/jobs/${activity.entityId}`
      : activity.activityUrl
    : isBillingAction
    ? "/billing"
    : null;

  const handleCopyPayload = () => {
    const payload = {
      id: activity._id,
      type: activity.type,
      category: activity.category,
      status: activity.status,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata,
      ipAddress: activity.ipAddress,
      entityType: activity.entityType,
      entityId: activity.entityId,
      createdAt: activity.createdAt,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group p-4 transition-all duration-150 hover:bg-muted/40",
        isExpanded && "bg-muted/25"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Icon and Details */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors",
              getActivityIconContainerClass(activity.category)
            )}
          >
            {getActivityIcon(activity)}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate max-w-sm sm:max-w-md">
                {activity.title}
              </span>
              {getCategoryBadge(activity.category)}
              {getStatusIndicator(activity.status)}
            </div>

            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {activity.description}
              </p>
            )}

            {/* Quick Metadata tags */}
            {activity.metadata && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {activity.metadata.amount !== undefined && (
                  <span className="inline-flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {activity.metadata.amount}{" "}
                    {activity.metadata.amount === 1 ? "credit" : "credits"}
                  </span>
                )}
                {activity.metadata.clipCount !== undefined && (
                  <span className="inline-flex items-center text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {activity.metadata.clipCount}{" "}
                    {activity.metadata.clipCount === 1 ? "clip" : "clips"}
                  </span>
                )}
                {activity.metadata.plan && (
                  <span className="inline-flex items-center text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                    Plan: {String(activity.metadata.plan).toUpperCase()}
                  </span>
                )}
                {activity.metadata.sourcePlatform && (
                  <span className="inline-flex items-center text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                    Platform: {String(activity.metadata.sourcePlatform)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timestamp and Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <span
            className="text-xs text-muted-foreground font-mono"
            title={new Date(activity.createdAt).toLocaleString()}
          >
            {formatRelativeTime(activity.createdAt)}
          </span>

          {targetUrl && (
            <Link href={targetUrl}>
              <AppButton
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 hover:border-primary/40 hover:bg-primary/5 cursor-pointer shadow-2xs"
              >
                <span>{isBillingAction ? "Manage" : "View"}</span>
                <ArrowRightIcon className="h-3.5 w-3.5 opacity-70" />
              </AppButton>
            </Link>
          )}

          {hasMetadata && (
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2"
            >
              {isExpanded ? "Hide" : "Details"}
            </AppButton>
          )}
        </div>
      </div>

      {/* Expanded Metadata Inspector */}
      {isExpanded && hasMetadata && (
        <div className="mt-3 pt-3 border-t border-border/30 pl-0 sm:pl-13">
          <div className="rounded-xl bg-card border border-border/70 p-3 font-mono text-[11px] text-muted-foreground space-y-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-foreground font-semibold text-xs">
                Event Payload & Metadata
              </span>
              <button
                onClick={handleCopyPayload}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Copied!</span>
                  </>
                ) : (
                  <span>Copy JSON</span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 overflow-x-auto">
              {Object.entries(activity.metadata || {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 truncate">
                  <span className="text-primary font-medium">{key}:</span>
                  <span className="text-foreground truncate">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
              {activity.entityType && (
                <div className="flex items-center gap-2 truncate">
                  <span className="text-primary font-medium">entity:</span>
                  <span className="text-foreground truncate">
                    {activity.entityType} ({activity.entityId || "none"})
                  </span>
                </div>
              )}
              {activity.ipAddress && (
                <div className="flex items-center gap-2 truncate">
                  <span className="text-primary font-medium">clientIp:</span>
                  <span className="text-foreground truncate">
                    {activity.ipAddress}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

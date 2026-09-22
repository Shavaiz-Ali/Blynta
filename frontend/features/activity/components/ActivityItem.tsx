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
      return "bg-primary/10 text-primary border-primary/20";
    case ActivityCategory.CREDIT:
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case ActivityCategory.BILLING:
      return "bg-violet-500/10 text-violet-500 border-violet-500/20";
    case ActivityCategory.REFERRAL:
      return "bg-pink-500/10 text-pink-500 border-pink-500/20";
    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      return "bg-sky-500/10 text-sky-500 border-sky-500/20";
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
          className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium px-2 py-0.5"
        >
          Job
        </Badge>
      );
    case ActivityCategory.CREDIT:
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-medium px-2 py-0.5"
        >
          Credits
        </Badge>
      );
    case ActivityCategory.BILLING:
      return (
        <Badge
          variant="secondary"
          className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[11px] font-medium px-2 py-0.5"
        >
          Billing
        </Badge>
      );
    case ActivityCategory.REFERRAL:
      return (
        <Badge
          variant="secondary"
          className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 text-[11px] font-medium px-2 py-0.5"
        >
          Referral
        </Badge>
      );
    case ActivityCategory.AUTH:
    case ActivityCategory.ACCOUNT:
      return (
        <Badge
          variant="secondary"
          className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[11px] font-medium px-2 py-0.5"
        >
          Account
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground border-border/60 text-[11px] font-medium px-2 py-0.5"
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
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          <span>Success</span>
        </span>
      );
    case ActivityStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          <span>Processing</span>
        </span>
      );
    case ActivityStatus.FAILED:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-500">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
          <span>Failed</span>
        </span>
      );
    case ActivityStatus.CANCELLED:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
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

    if (diffSeconds < 0 || diffSeconds < 60) return "just now";
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

function metaText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : null;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const metaAmount = metaText(activity.metadata?.amount);
  const metaClipCount = metaText(activity.metadata?.clipCount);
  const metaPlan = metaText(activity.metadata?.plan);
  const metaSourcePlatform = metaText(activity.metadata?.sourcePlatform);

  const rawActivityUrl = activity.activityUrl?.trim();
  const targetUrl = !rawActivityUrl
    ? null
    : rawActivityUrl.startsWith("/dashboard/jobs/")
      ? rawActivityUrl.replace("/dashboard/jobs/", "/jobs/")
      : rawActivityUrl.startsWith("/") &&
          rawActivityUrl !== "/" &&
          !rawActivityUrl.startsWith("//")
        ? rawActivityUrl
        : null;

  const isBillingAction = activity.category === ActivityCategory.BILLING;

  return (
    <div className="group px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-150 hover:bg-muted/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Icon and Details */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors shadow-2xs mt-0.5 sm:mt-0",
              getActivityIconContainerClass(activity.category)
            )}
          >
            {getActivityIcon(activity)}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-sm sm:max-w-md">
                {activity.title}
              </span>
              {getCategoryBadge(activity.category)}
              {getStatusIndicator(activity.status)}
            </div>

            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                {activity.description}
              </p>
            )}

            {/* Quick Metadata pills */}
            {activity.metadata && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {metaAmount && (
                  <span className="inline-flex items-center text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {metaAmount} {metaAmount === "1" ? "credit" : "credits"}
                  </span>
                )}
                {metaClipCount && (
                  <span className="inline-flex items-center text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {metaClipCount} {metaClipCount === "1" ? "clip" : "clips"}
                  </span>
                )}
                {metaPlan && (
                  <span className="inline-flex items-center text-[11px] font-medium text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                    Plan: {metaPlan.toUpperCase()}
                  </span>
                )}
                {metaSourcePlatform && (
                  <span className="inline-flex items-center text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                    Platform: {metaSourcePlatform}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timestamp and Action Button */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
          <span
            className="text-xs text-muted-foreground font-mono whitespace-nowrap min-w-[50px] text-right"
            title={new Date(activity.createdAt).toLocaleString()}
          >
            {formatRelativeTime(activity.createdAt)}
          </span>

          {targetUrl && (
            <Link href={targetUrl} className="shrink-0">
              <AppButton
                variant="outline"
                size="sm"
                icon={<ArrowRightIcon className="h-3 w-3 opacity-70" />}
                iconPosition="right"
                className="h-7 sm:h-8 text-xs font-semibold px-2.5 sm:px-3 hover:border-primary/40 hover:bg-primary/5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
              >
                {isBillingAction ? "Manage" : "View"}
              </AppButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clip, Highlight, Job, JobStatus } from "@/features/jobs";
import { PlayIcon, SparklesIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

export interface ClipInformationProps {
  job: Job;
  clip: Clip;
  highlight?: Highlight;
  clipTitle: string;
  clipIndex: number;
  totalClips: number;
  sourceHref: string;
  onWatch: () => void;
  className?: string;
}

function platformLabel(platform: string): string {
  if (!platform) return "Source";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** Status is a quiet inline signal — never another badge. */
function clipStatus(status: JobStatus): { label: string; dot: string } {
  switch (status) {
    case JobStatus.COMPLETED:
      return { label: "Ready to publish", dot: "bg-emerald-500" };
    case JobStatus.FAILED:
      return { label: "Processing failed", dot: "bg-destructive" };
    default:
      return { label: "Processing", dot: "bg-muted-foreground" };
  }
}

/**
 * Answers "what clip am I looking at?" — identity, position and a single
 * primary action. No settings, no fields, no cards.
 */
export function ClipInformation({
  job,
  clip,
  highlight,
  clipTitle,
  clipIndex,
  totalClips,
  sourceHref,
  onWatch,
  className,
}: ClipInformationProps) {
  const durationSec = Math.max(0, Math.round(clip.endTime - clip.startTime));
  const status = clipStatus(clip.status);
  const sourceTitle = job.videoTitle || `${platformLabel(job.sourcePlatform)} video`;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      {/* Type + position */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          <SparklesIcon className="h-3.5 w-3.5" />
          AI generated short
        </span>
        <span className="text-xs text-muted-foreground">
          Short {clipIndex + 1} of {Math.max(totalClips, 1)}
        </span>
      </div>

      {/* Title + description */}
      <div className="space-y-2">
        <h1 className="break-words text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
          {clipTitle}
        </h1>
        {highlight?.clipDescription && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {highlight.clipDescription}
          </p>
        )}
      </div>

      {/* Basic metadata */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">Source</span>
          <Link
            href={sourceHref}
            className="max-w-[200px] truncate font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {sourceTitle}
          </Link>
        </span>
        <Separator orientation="vertical" className="h-3.5" />
        <span className="tabular-nums">{durationSec}s</span>
        <Separator orientation="vertical" className="h-3.5" />
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      {/* Primary action for the clip */}
      <div>
        <Button
          variant="default"
          size="sm"
          onClick={onWatch}
          className="cursor-pointer gap-1.5 font-semibold shadow-xs"
        >
          <PlayIcon className="h-3.5 w-3.5 fill-current" />
          Watch Short
        </Button>
      </div>
    </div>
  );
}
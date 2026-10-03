"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Clip, Highlight, Job, JobStatus } from "@/features/jobs";
import {
  ClockIcon,
  FilmIcon,
  PlayIcon,
  SparklesIcon,
} from "@/features/dashboard/icons";
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
  const sourceTitle =
    job.videoTitle || `${platformLabel(job.sourcePlatform)} video`;
  const scorePercent =
    typeof highlight?.score === "number"
      ? Math.max(0, Math.min(100, Math.round(highlight.score * 100)))
      : null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-5", className)}>
      {/* Type + position */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          <SparklesIcon className="h-3.5 w-3.5" />
          AI generated short
        </span>
        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          Short {clipIndex + 1} of {Math.max(totalClips, 1)}
        </span>
        {scorePercent !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
            <span className="text-primary">{scorePercent}</span>
            virality score
          </span>
        )}
      </div>

      {/* Title + description */}
      <div className="space-y-3">
        <h1 className="max-w-4xl break-words text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {clipTitle}
        </h1>
        {highlight?.clipDescription && (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {highlight.clipDescription}
          </p>
        )}
      </div>

      {/* Basic metadata */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-background/50 p-3">
          <FilmIcon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </p>
            <Link
              href={sourceHref}
              className="mt-0.5 block truncate text-xs font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {sourceTitle}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/50 p-3">
          <ClockIcon className="h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
              {durationSec} seconds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/50 p-3">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <p className="mt-0.5 text-xs font-semibold text-foreground">
              {status.label}
            </p>
          </div>
        </div>
      </div>

      {/* Primary action for the clip */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="default"
          onClick={onWatch}
          size="lg"
          className="w-full cursor-pointer gap-2 px-5 font-semibold shadow-sm sm:w-auto"
        >
          <PlayIcon className="h-3.5 w-3.5 fill-current" />
          Preview short
        </Button>
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Review playback, captions and framing
        </p>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { PlayIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime } from "./utils";

export interface ClipPreviewProps {
  posterUrl?: string;
  clipTitle: string;
  clipIndex: number;
  startTime: number;
  endTime: number;
  onOpenViewer: () => void;
  className?: string;
}

/**
 * The primary visual element of the review page.
 * A single tappable video frame — no card wrapper and no overlays competing
 * with the footage. Its width (and therefore its height) is controlled by the
 * layout so the preview stays a compact card rather than a full-height screen.
 */
export function ClipPreview({
  posterUrl,
  clipTitle,
  clipIndex,
  startTime,
  endTime,
  onOpenViewer,
  className,
}: ClipPreviewProps) {
  return (
    <button
      type="button"
      onClick={onOpenViewer}
      aria-label={`Watch ${clipTitle}`}
      title="Open media workspace"
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg bg-muted/40 text-left",
        "ring-1 ring-border/70 shadow-sm transition-all duration-200",
        "hover:ring-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        "cursor-pointer",
        className
      )}
    >
      <AspectRatio ratio={9 / 16}>
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-85"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/20 text-muted-foreground">
            <PlayIcon className="h-5 w-5 text-primary/70" />
            <span className="text-[10px] font-medium">Short #{clipIndex + 1}</span>
          </div>
        )}

        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/5" />

        {/* Play affordance */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg ring-1 ring-border backdrop-blur-sm transition-all duration-200 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/40">
            <PlayIcon className="h-4 w-4 fill-current pl-0.5" />
          </span>
        </div>

        {/* Minimal overlay: source in-point and clip length only */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
          <span className="font-mono text-[10px] tabular-nums text-white/85 drop-shadow-sm">
            {formatTime(startTime)}
          </span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-white/90">
            {formatDuration(startTime, endTime)}
          </span>
        </div>
      </AspectRatio>
    </button>
  );
}
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clip } from "@/features/jobs";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, FilmIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

export interface ClipNavigationBarProps {
  jobId: string;
  clips: Clip[];
  activeClipIndex: number;
  className?: string;
  variant?: "rail" | "compact";
}

function formatClipDuration(startTime: number, endTime: number): string {
  const dur = Math.max(0, Math.round(endTime - startTime));
  return `${dur}s`;
}

export function ClipNavigationBar({
  jobId,
  clips,
  activeClipIndex,
  className,
  variant = "rail",
}: ClipNavigationBarProps) {
  const router = useRouter();
  const totalClips = clips.length;

  if (totalClips <= 1) return null;

  const prevClip = activeClipIndex > 0 ? clips[activeClipIndex - 1] : null;
  const nextClip = activeClipIndex < totalClips - 1 ? clips[activeClipIndex + 1] : null;

  const getClipId = (c: Clip) => c._id || c.id;

  const handleNavigate = (c: Clip) => {
    const cid = getClipId(c);
    if (cid) {
      router.push(`/my-clips/${jobId}/clips/${cid}`);
    }
  };

  // Keyboard navigation: Alt + Left / Alt + Right
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.altKey && e.key === "ArrowLeft" && prevClip) {
        e.preventDefault();
        handleNavigate(prevClip);
      } else if (e.altKey && e.key === "ArrowRight" && nextClip) {
        e.preventDefault();
        handleNavigate(nextClip);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevClip, nextClip]);

  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 p-1 rounded-md bg-muted/40 border border-border text-xs", className)}>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!prevClip}
          onClick={() => prevClip && handleNavigate(prevClip)}
          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
          title="Previous Short (Alt + Left)"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </Button>

        <span className="font-semibold text-foreground px-1 select-none text-[11px] whitespace-nowrap">
          Short {activeClipIndex + 1} of {totalClips}
        </span>

        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!nextClip}
          onClick={() => nextClip && handleNavigate(nextClip)}
          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
          title="Next Short (Alt + Right)"
        >
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  // Full-width Rail Variant
  return (
    <div
      className={cn(
        "p-3 sm:p-3.5 rounded-lg bg-card border border-border/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <FilmIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold text-foreground uppercase tracking-wider text-xs">
            Generated Shorts
          </span>
          <span className="text-muted-foreground text-xs font-normal">
            ({totalClips})
          </span>
        </div>

        <div className="flex items-center gap-1 sm:hidden">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!prevClip}
            onClick={() => prevClip && handleNavigate(prevClip)}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
            title="Previous Short"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!nextClip}
            onClick={() => nextClip && handleNavigate(nextClip)}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
            title="Next Short"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-full no-scrollbar flex-1 justify-start sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={!prevClip}
          onClick={() => prevClip && handleNavigate(prevClip)}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 hidden sm:flex items-center gap-1 hover:bg-muted shrink-0"
          title="Previous Short (Alt + Left)"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          <span>Prev</span>
        </Button>

        {clips.map((clip, idx) => {
          const isActive = idx === activeClipIndex;
          const cid = getClipId(clip);
          const duration = formatClipDuration(clip.startTime, clip.endTime);

          return (
            <button
              key={cid || idx}
              type="button"
              onClick={() => handleNavigate(clip)}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-all cursor-pointer select-none flex items-center gap-1.5 shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary/40"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70"
              )}
              title={`Short #${idx + 1} (${duration})`}
            >
              <span>Short #{idx + 1}</span>
              <span
                className={cn(
                  "text-[10px] font-mono",
                  isActive ? "text-primary-foreground/90 font-bold" : "text-muted-foreground"
                )}
              >
                {duration}
              </span>
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          disabled={!nextClip}
          onClick={() => nextClip && handleNavigate(nextClip)}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 hidden sm:flex items-center gap-1 hover:bg-muted shrink-0"
          title="Next Short (Alt + Right)"
        >
          <span>Next</span>
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}



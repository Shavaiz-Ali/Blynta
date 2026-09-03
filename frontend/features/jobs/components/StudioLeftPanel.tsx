"use client";

import * as React from "react";
import { Job, Highlight, Clip } from "@/features/jobs/types";
import { ScoreGauge } from "./ScoreGauge";
import { formatTimestamp } from "@/features/dashboard/utils";
import { SparklesIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

interface StudioLeftPanelProps {
  job: Job;
  activeHighlight?: Highlight;
  activeClip?: Clip;
}

export function StudioLeftPanel({
  activeHighlight,
  activeClip,
}: StudioLeftPanelProps) {
  const displayScore =
    typeof activeHighlight?.score === "number"
      ? Math.round(activeHighlight.score * 100)
      : null;

  const isHighImpact = (displayScore ?? 0) >= 80;
  const clipStart = activeClip?.startTime ?? activeHighlight?.startTime ?? 0;
  const clipEnd = activeClip?.endTime ?? activeHighlight?.endTime ?? 0;
  const clipDuration = Math.max(0, clipEnd - clipStart);

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* Viral Hook Potential Card with Arc Meter */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Viral Hook Potential
            </h3>
          </div>
          {displayScore !== null && (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border",
                isHighImpact
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-chart-4/15 text-chart-4 border-chart-4/30"
              )}
            >
              {isHighImpact ? "High Impact" : "Engaging"}
            </span>
          )}
        </div>

        {/* Visual Score Arc Meter & Retention Hook Summary */}
        <div className="flex items-center gap-4 py-1">
          {displayScore !== null ? (
            <ScoreGauge score={displayScore} />
          ) : (
            <div className="text-3xl font-black text-foreground">—</div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <span className="text-xs font-semibold text-foreground">
              {isHighImpact ? "Strong Retention Hook" : "Steady Engagement"}
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              Analyzed for strong 3-second opening hook and continuous viewer retention.
            </p>
          </div>
        </div>

        {/* Clip Timeframe Range */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground">
            Timestamp Range:
          </span>
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatTimestamp(clipStart)} → {formatTimestamp(clipEnd)}{" "}
            <span className="text-muted-foreground font-normal">
              ({Math.round(clipDuration)}s)
            </span>
          </span>
        </div>

        {/* Why this clip works */}
        {activeHighlight?.reason && (
          <div className="pt-2 border-t border-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Why this clip works
            </span>
            <p className="text-xs text-foreground/85 leading-relaxed">
              {activeHighlight.reason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

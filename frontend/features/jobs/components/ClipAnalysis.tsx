"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import {
  SparklesIcon,
  LightbulbIcon,
} from "@/features/dashboard/icons";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";

export interface ClipAnalysisProps {
  job: Job;
  highlight?: Highlight;
}

export function ClipAnalysis({ job, highlight }: ClipAnalysisProps) {
  const scorePercent = highlight?.score ? Math.round(highlight.score * 100) : 85;
  const whyItWorks =
    highlight?.reason ||
    highlight?.clipDescription ||
    "This highlight captures a high-retention moment with immediate emotional or informational payoff, keeping audience drop-off minimal.";
  const hookType = highlight?.style || "Curiosity Hook";
  const hookText = highlight?.hookText || highlight?.clipTitle || "";

  return (
    <div className="space-y-4">
      {/* ── Virality & Hook Score Section ── */}
      <AppCard className="" useDefaultClasses={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <SparklesIcon className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-foreground">
              AI Viral Score
            </span>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
            {hookType}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2 my-2">
          <span className="text-3xl font-extrabold text-foreground font-mono">
            {scorePercent}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            / 100 virality potential
          </span>
        </div>

        {/* Progress gauge bar */}
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </AppCard>

      {/* ── Why This Clip Works (AI Explanation) ── */}
      <AppCard className="space-y-2" useDefaultClasses={false}>
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <LightbulbIcon className="h-4 w-4 text-amber-500" />
          <span>Why this clip works</span>
        </div>

        <div className="my-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {whyItWorks}
          </p>
        </div>

        {hookText && (
          <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Opening Retention Hook
            </span>
            <span className="text-foreground italic">&ldquo;{hookText}&rdquo;</span>
          </div>
        )}
      </AppCard>
    </div>
  );
}

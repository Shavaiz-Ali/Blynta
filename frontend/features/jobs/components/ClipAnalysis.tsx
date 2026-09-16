"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import {
  SparklesIcon,
  LightbulbIcon,
  QuoteIcon,
} from "@/features/dashboard/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
    <div className="space-y-3.5">
      {/* ── Top Header & Integrated Metric ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            AI Virality Analysis
          </h3>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold px-2 py-0 rounded-md"
          >
            {hookType}
          </Badge>
        </div>

        {/* Compact Virality Score Gauge */}
        <div className="flex items-center gap-3 self-start sm:self-center bg-muted/30 px-3 py-1.5 rounded-md border border-border/60">
          <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Virality Potential
          </div>
          <div className="w-24 sm:w-28">
            <Progress
              value={scorePercent}
              className="h-1.5 rounded-full overflow-hidden bg-muted/80"
            />
          </div>
          <div className="flex items-baseline gap-0.5 font-mono text-xs">
            <span className="font-bold text-foreground">{scorePercent}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>
      </div>

      {/* ── Editorial Insights Split ── */}
      <div className={hookText ? "grid grid-cols-1 lg:grid-cols-12 gap-3.5" : "space-y-2"}>
        {/* Why this clip works */}
        <div className={hookText ? "lg:col-span-7 space-y-1.5" : "space-y-1.5"}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <LightbulbIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>Why this clip works</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {whyItWorks}
          </p>
        </div>

        {/* Opening Retention Hook */}
        {hookText && (
          <div className="lg:col-span-5 p-3 rounded-md bg-muted/25 border border-border/60 text-xs space-y-1 self-start">
            <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
              <QuoteIcon className="h-3 w-3" />
              <span>Opening Hook</span>
            </div>
            <p className="text-foreground italic leading-relaxed text-xs">
              &ldquo;{hookText}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



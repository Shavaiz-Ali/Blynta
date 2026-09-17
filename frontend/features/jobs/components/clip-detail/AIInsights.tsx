"use client";

import { Highlight, Job } from "@/features/jobs";
import { AppCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { GaugeIcon, SparklesIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

export interface AIInsightsProps {
  job?: Job;
  highlight?: Highlight;
  className?: string;
}

const DEFAULT_WHY =
  "This highlight captures a high-retention moment with immediate emotional or informational payoff, keeping audience drop-off minimal.";

const CARD_LABEL_CLASS =
  "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * Compact AI insight card: virality score, why the clip works and the opening
 * hook. Two short columns instead of a dashboard widget.
 */
export function AIInsights({ highlight, className }: AIInsightsProps) {
  const scorePercent =
    typeof highlight?.score === "number"
      ? Math.max(0, Math.min(100, Math.round(highlight.score * 100)))
      : null;

  const whyItWorks = highlight?.reason || highlight?.clipDescription || DEFAULT_WHY;
  const hookText = highlight?.hookText || highlight?.clipTitle || "";

  return (
    <AppCard
      size="sm"
      className={cn(className)}
      title={
        <span className={CARD_LABEL_CLASS}>
          <SparklesIcon className="h-3.5 w-3.5 text-primary" />
          AI insight
        </span>
      }
      titleClassName={CARD_LABEL_CLASS}
      headerAction={
        scorePercent !== null ? (
          <Badge
            variant="outline"
            className="gap-1.5 px-2 text-[11px] font-normal text-muted-foreground"
          >
            <GaugeIcon className="text-primary" />
            <span className="font-semibold tabular-nums text-foreground">{scorePercent}</span>
            virality score
          </Badge>
        ) : null
      }
      contentClassName="px-3 pb-0"
    >
      <div className="grid w-full gap-x-8 gap-y-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Why this clip works */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-foreground">Why this clip works</h3>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {whyItWorks}
          </p>
        </div>

        {/* Opening hook */}
        {hookText && (
          <div className="space-y-1 border-l-2 border-primary/40 pl-3.5">
            <h3 className={CARD_LABEL_CLASS}>Opening hook</h3>
            <p className="text-sm italic leading-relaxed text-foreground">
              &ldquo;{hookText}&rdquo;
            </p>
          </div>
        )}
      </div>
    </AppCard>
  );
}
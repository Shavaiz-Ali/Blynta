"use client";

import Link from "next/link";
import { Highlight, Job } from "@/features/jobs";
import type { UserPlan } from "@/features/auth/types";
import { AppCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AIInsightsProps {
  job?: Job;
  highlight?: Highlight;
  plan?: UserPlan;
  onSchedule?: () => void;
  className?: string;
}

const DEFAULT_WHY =
  "This highlight captures a high-retention moment with immediate emotional or informational payoff, keeping audience drop-off minimal.";

const CARD_LABEL_CLASS =
  "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * A focused explanation of why the moment was selected. The score is treated
 * as supporting evidence instead of competing with the explanation.
 */
export function AIInsights({
  highlight,
  plan,
  onSchedule,
  className,
}: AIInsightsProps) {
  const whyItWorks =
    highlight?.reason || highlight?.clipDescription || DEFAULT_WHY;
  const hookText = highlight?.hookText || highlight?.clipTitle || "";

  return (
    <AppCard
      className={cn("h-full overflow-hidden rounded-2xl", className)}
      title={<span className={CARD_LABEL_CLASS}>AI insight</span>}
      titleClassName={CARD_LABEL_CLASS}
      description="What makes this moment worth publishing"
      contentClassName="flex flex-1 flex-col px-5 pb-5 pt-0 sm:px-6 sm:pb-6"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">
            Why this clip works
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {whyItWorks}
          </p>
        </div>

        {hookText && (
          <div className="space-y-2 border-l-2 border-primary/50 py-1 pl-4">
            <h3 className={CARD_LABEL_CLASS}>Opening hook</h3>
            <p className="text-base font-medium italic leading-6 text-foreground">
              &ldquo;{hookText}&rdquo;
            </p>
          </div>
        )}

        <div className="mt-auto pt-2">
          {plan === "free" ? (
            <Link
              href="/billing"
              className="group relative block overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-4 transition-colors hover:border-primary/45"
            >
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-2xl"
              />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Create more with Pro
                </p>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  More credits, HD exports and faster processing
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Upgrade when you are ready to publish more clips without
                  slowing down.
                </p>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                  Explore plans{" "}
                  <span aria-hidden="true" className="ml-1">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Next step
              </p>
              <h3 className="mt-1 text-sm font-semibold text-foreground">
                Put this short on your content calendar
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Choose a date and time now, then manage it alongside your other
                scheduled posts.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSchedule}
                className="mt-3 cursor-pointer"
              >
                Schedule this short
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppCard>
  );
}

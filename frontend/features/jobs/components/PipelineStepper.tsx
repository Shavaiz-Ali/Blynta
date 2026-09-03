"use client";

import * as React from "react";
import { JobStatus } from "@/features/jobs/types";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STEPS,
  getPipelineStepState,
  isProcessingStatus,
} from "@/features/dashboard/utils";
import { CheckIcon } from "@/features/dashboard/icons";

interface PipelineStepperProps {
  status: JobStatus;
  progressPercent?: number;
  className?: string;
  compact?: boolean;
}

export function PipelineStepper({
  status,
  progressPercent,
  className,
  compact = false,
}: PipelineStepperProps) {
  if (!isProcessingStatus(status)) return null;

  const visibleSteps = PIPELINE_STEPS.filter(
    (s) => s.key !== JobStatus.COMPLETED
  );

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/80 bg-card/60 overflow-x-auto shadow-2xs backdrop-blur-sm",
        compact ? "px-3 sm:px-4 py-2.5" : "px-4 sm:px-5 py-3.5",
        className
      )}
    >
      <ol className="flex items-center gap-1.5 sm:gap-2.5 min-w-max">
        {visibleSteps.map((step, idx) => {
          const state = getPipelineStepState(step.key, status);
          const isLast = idx === visibleSteps.length - 1;
          const doneAfter = isStepDoneAfter(step.key, status);

          const isProgressCapable =
            step.key === JobStatus.PENDING || step.key === JobStatus.TRANSCRIBING;
          const showProgress = isProgressCapable && state === "active";
          const pct = Math.min(100, Math.max(0, Math.round(progressPercent ?? 0)));

          return (
            <React.Fragment key={step.key}>
              <li className="flex items-center gap-2 shrink-0">
                <div
                  className={cn(
                    "relative flex shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all",
                    compact ? "h-6 w-6 text-[10px]" : "h-7 w-7",
                    state === "done" &&
                      "bg-chart-1/15 border-chart-1/40 text-chart-1",
                    state === "active" &&
                      "bg-primary/15 border-primary/40 text-primary",
                    state === "pending" &&
                      "bg-muted/50 border-border/60 text-muted-foreground/60"
                  )}
                >
                  {state === "active" && (
                    <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  )}
                  <span className="relative">
                    {state === "done" ? (
                      <CheckIcon className={cn("stroke-[3]", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                    ) : (
                      idx + 1
                    )}
                  </span>
                </div>
                <div className="flex flex-col min-w-[70px]">
                  <span
                    className={cn(
                      "font-medium whitespace-nowrap",
                      compact ? "text-[11px]" : "text-xs",
                      state === "done" && "text-foreground",
                      state === "active" && "text-primary font-semibold",
                      state === "pending" && "text-muted-foreground/60"
                    )}
                  >
                    {step.label}
                    {showProgress ? (
                      <span className="ml-1.5 font-bold text-primary tabular-nums">
                        {pct}%
                      </span>
                    ) : (
                      state === "active" && (
                        <span className="ml-0.5 text-primary/70">…</span>
                      )
                    )}
                  </span>
                  {showProgress && (
                    <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </li>
              {!isLast && (
                <li
                  aria-hidden
                  className={cn(
                    "h-px shrink-0 transition-colors",
                    compact ? "w-4 sm:w-6" : "w-5 sm:w-8",
                    doneAfter ? "bg-chart-1/40" : "bg-border/60"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function isStepDoneAfter(stepKey: JobStatus, status: JobStatus): boolean {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stepKey);
  const cur = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx < cur;
}

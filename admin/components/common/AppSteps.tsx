"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppStepDef {
  id: string;
  label: string;
  description?: string;
}

export interface AppStepsProps {
  steps: AppStepDef[];
  /** Zero-indexed index of the currently active step. */
  currentStep: number;
  className?: string;
}

export function AppSteps({ steps, currentStep, className }: AppStepsProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full py-1 space-y-1.5", className)}>
      {/* 1. Circles & direct connector lines */}
      <div className="flex items-center w-full px-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Circle */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-200 z-10",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground shadow-2xs",
                  isCurrent &&
                    "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                  isUpcoming && "bg-background border-border text-muted-foreground"
                )}
                aria-current={isCurrent ? "step" : undefined}
                aria-hidden="true"
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Direct line touching circles with zero gap */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex-1 h-0.5 transition-all duration-300",
                    index < currentStep ? "bg-primary" : "bg-border/80"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 2. Labels row */}
      <div className="flex items-start justify-between w-full">
        {steps.map((step, index) => {
          const isCurrent = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;
          const isFirst = index === 0;
          const isLast = index === steps.length - 1;

          return (
            <div
              key={step.id}
              className={cn(
                "flex flex-col min-w-0 max-w-[100px]",
                isFirst && "items-start text-left",
                isLast && "items-end text-right",
                !isFirst && !isLast && "items-center text-center"
              )}
            >
              <p
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  isCurrent && "text-foreground font-bold",
                  isCompleted && "text-foreground font-semibold",
                  isUpcoming && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 truncate">
                  {step.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

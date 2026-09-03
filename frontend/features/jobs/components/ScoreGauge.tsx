"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreGauge({ score, className, size = "md" }: ScoreGaugeProps) {
  const radius = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const viewBoxSize = (radius + 10) * 2;
  const center = viewBoxSize / 2;
  const strokeWidth = size === "sm" ? 5 : size === "lg" ? 8 : 6.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const scoreColor =
    score >= 80
      ? "stroke-primary"
      : score >= 60
        ? "stroke-chart-4"
        : "stroke-muted-foreground";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0",
        size === "sm" && "w-16 h-16",
        size === "md" && "w-22 h-22",
        size === "lg" && "w-28 h-28",
        className
      )}
    >
      <svg
        className="w-full h-full transform -rotate-90"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-muted/50"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          className={cn(
            scoreColor,
            "transition-all duration-1000 ease-out"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            "font-black text-foreground tabular-nums leading-none",
            size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl"
          )}
        >
          {score}
        </span>
        <span
          className={cn(
            "font-bold text-muted-foreground uppercase tracking-wider",
            size === "sm" ? "text-[8px] mt-0.5" : "text-[9px] mt-0.5"
          )}
        >
          Score
        </span>
      </div>
    </div>
  );
}

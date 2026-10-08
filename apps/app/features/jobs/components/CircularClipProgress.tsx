"use client";

import { percentage } from "../processing-state";

const radius = 28;
const circumference = 2 * Math.PI * radius;

export function CircularClipProgress({
  value,
  stage,
}: {
  value?: number;
  stage: string;
}) {
  // An active clip is never ready, even if a worker rounds its sample to 100.
  const sample = percentage(value);
  const percent = sample === undefined ? undefined : Math.min(99, sample);
  return (
    <div
      role="progressbar"
      aria-label={`${stage} — overall clip progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={
        percent === undefined
          ? "Waiting for progress update"
          : `${percent}% complete`
      }
      className="relative flex size-18 shrink-0 items-center justify-center text-foreground"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 72 72"
        className="absolute inset-0 size-full -rotate-90 fill-none"
      >
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/25"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (percent ?? 0) / 100)}
          className="text-primary transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span
        aria-hidden="true"
        className="text-base font-semibold tabular-nums tracking-tight"
      >
        {percent === undefined ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

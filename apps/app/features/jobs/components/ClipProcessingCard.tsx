"use client";
import { CheckCircle, AlertTriangle, Clock, LoaderCircle } from "lucide-react";
import type { Job, Clip, Highlight } from "../types";
import { clipState, percentage } from "../processing-state";
import { formatRemainingTime } from "../format-eta";
import { FailedClipCard } from "./FailedClipCard";

const labels = {
  queued: "Waiting to process",
  cutting: "Cutting video",
  captioning: "Adding captions",
  uploading: "Finalizing",
  ready: "Ready",
  failed: "Processing failed",
};
function time(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}
export function ProcessingProgress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percent = percentage(value) ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: percent + "%" }}
        />
      </div>
    </div>
  );
}
export function ClipProcessingCard({
  job,
  clip,
  index,
  highlight,
}: {
  job: Job;
  clip?: Clip;
  index: number;
  highlight?: Highlight;
}) {
  const { status, progress } = clip
    ? clipState(job, clip)
    : { status: "queued" as const, progress: undefined };
  const active = ["cutting", "captioning", "uploading"].includes(status);
  const Icon =
    status === "ready"
      ? CheckCircle
      : status === "failed"
        ? AlertTriangle
        : active
          ? LoaderCircle
          : Clock;
  const pct = percentage(progress?.progress);
  const eta = formatRemainingTime(progress?.etaSeconds);
  if (status === "failed" && clip)
    return (
      <FailedClipCard
        job={job}
        clip={clip}
        index={index}
        title={highlight?.clipTitle || highlight?.hookText || "Video highlight"}
      />
    );
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            Clip {String(index + 1).padStart(2, "0")}
          </p>
          <p className="break-words text-sm font-medium">
            {highlight?.clipTitle || highlight?.hookText || "Video highlight"}
          </p>
        </div>
        <Icon
          aria-hidden="true"
          className={
            "h-4 w-4 shrink-0 " +
            (active
              ? "text-primary animate-spin motion-reduce:animate-none"
              : status === "failed"
                ? "text-destructive"
                : "text-muted-foreground")
          }
        />
      </div>
      {(!active || pct === undefined) && (
        <p className="text-xs font-medium">{labels[status]}</p>
      )}
      {active && pct !== undefined && (
        <ProcessingProgress value={pct} label={labels[status]} />
      )}
      {active && progress && (
        <div className="flex flex-wrap justify-between gap-2 text-xs tabular-nums text-muted-foreground">
          {Number.isFinite(progress.processedSeconds) &&
            Number.isFinite(progress.durationSeconds) && (
              <span>
                {time(progress.processedSeconds!)} /{" "}
                {time(progress.durationSeconds)}
              </span>
            )}
          {eta && status !== "uploading" && <span>{eta} in this stage</span>}
        </div>
      )}
    </div>
  );
}

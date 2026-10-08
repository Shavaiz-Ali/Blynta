"use client";
import { CheckCircle, AlertTriangle, Clock, LoaderCircle } from "lucide-react";
import type { Job, Clip, Highlight } from "../types";
import { clipState, percentage } from "../processing-state";
import { formatRemainingTime } from "../format-eta";
import { formatClipTime } from "../clip-time";
import { FailedClipCard } from "./FailedClipCard";
import {
  ClipCardLayout,
  ClipCardTitle,
  ClipCardDescription,
  ClipCardControls,
  ClipPendingMedia,
} from "./ClipCardLayout";

const labels = {
  cancelled: "Processing cancelled",
  queued: "Waiting to process",
  cutting: "Cutting video",
  captioning: "Adding captions",
  uploading: "Finalizing",
  ready: "Ready",
  failed: "Processing failed",
};
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
        aria-label={`${label} — overall clip progress`}
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
  const stopped = job.status === "cancelling" || job.status === "cancelled";
  const active =
    !stopped && ["cutting", "captioning", "uploading"].includes(status);
  const Icon =
    status === "ready"
      ? CheckCircle
      : status === "failed"
        ? AlertTriangle
        : active
          ? LoaderCircle
          : Clock;
  const pct = percentage(progress?.progress);
  const hasStageTime =
    active &&
    progress &&
    Number.isFinite(progress.processedSeconds) &&
    progress.processedSeconds! >= 0 &&
    Number.isFinite(progress.durationSeconds) &&
    progress.durationSeconds > 0 &&
    progress.processedSeconds! <= progress.durationSeconds;
  const eta =
    hasStageTime &&
    status !== "uploading" &&
    progress.processedSeconds! < progress.durationSeconds &&
    (progress.speed === undefined ||
      (Number.isFinite(progress.speed) && progress.speed > 0)) &&
    progress.etaSeconds !== undefined &&
    progress.etaSeconds > 0
      ? formatRemainingTime(progress.etaSeconds)
      : null;
  if (status === "failed" && clip)
    return (
      <FailedClipCard
        job={job}
        clip={clip}
        index={index}
        title={highlight?.clipTitle || highlight?.hookText || "Video highlight"}
        highlight={highlight}
      />
    );
  return (
    <ClipCardLayout
      index={index}
      status={
        <span
          className={`inline-flex items-center gap-1.5 ${active ? "text-primary" : "text-muted-foreground"}`}
        >
          <Icon
            aria-hidden="true"
            className={`h-3 w-3 ${active ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {stopped
            ? job.status === "cancelling"
              ? "Cancelling…"
              : "Cancelled"
            : active
              ? "Processing"
              : status === "ready"
                ? "Ready"
                : "Waiting"}
        </span>
      }
      media={
        <ClipPendingMedia
          job={job}
          clip={clip}
          highlight={highlight}
          label={
            stopped
              ? "Processing stopped"
              : active
                ? "Creating your preview"
                : "Queued for processing"
          }
          icon={
            <Icon
              aria-hidden="true"
              className={`h-5 w-5 ${active ? "text-primary animate-spin motion-reduce:animate-none" : ""}`}
            />
          }
        />
      }
      footer={
        <div className="space-y-2">
          <ClipCardControls>
            <div className="w-full" aria-live="polite">
              {(!active || pct === undefined) && (
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {stopped
                    ? job.status === "cancelling"
                      ? "Stopping remaining work…"
                      : "Processing cancelled"
                    : labels[status]}
                </p>
              )}
              {active && pct !== undefined && (
                <ProcessingProgress value={pct} label={labels[status]} />
              )}
            </div>
          </ClipCardControls>
          {hasStageTime && (
            <div
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-[11px] leading-relaxed tabular-nums text-muted-foreground"
              data-clip-stage-timing
            >
              <span className="shrink-0">
                Stage time: {formatClipTime(progress.processedSeconds!)} /{" "}
                {formatClipTime(progress.durationSeconds)}
              </span>
              {eta && (
                <span className="min-w-0 flex-1 basis-32 break-words text-right">
                  {eta} in this stage
                </span>
              )}
            </div>
          )}
        </div>
      }
    >
      <ClipCardTitle>
        {highlight?.clipTitle || highlight?.hookText || "Video highlight"}
      </ClipCardTitle>
      <ClipCardDescription>
        {highlight?.reason ||
          highlight?.clipDescription ||
          (stopped
            ? "Finished clips are kept. This clip was not completed."
            : active
              ? "Your clip is being created. The preview will appear automatically when it’s ready."
              : "This clip is queued and will start automatically when processing is available.")}
      </ClipCardDescription>
    </ClipCardLayout>
  );
}

"use client";
import { CheckCircle, AlertTriangle, Clock, LoaderCircle } from "lucide-react";
import type { Job, Clip, Highlight } from "../types";
import { clipState, percentage } from "../processing-state";
import { formatRemainingTime } from "../format-eta";
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
  const eta = formatRemainingTime(progress?.etaSeconds);
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
          information={
            <>
              {" "}
              {active && progress && (
                <>
                  {Number.isFinite(progress.processedSeconds) &&
                    Number.isFinite(progress.durationSeconds) && (
                      <span>
                        {time(progress.processedSeconds!)} /{" "}
                        {time(progress.durationSeconds)}
                      </span>
                    )}
                  {eta && status !== "uploading" && (
                    <span>{eta} in this stage</span>
                  )}
                </>
              )}{" "}
            </>
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

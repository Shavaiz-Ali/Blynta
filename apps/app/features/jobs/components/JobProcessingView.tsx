"use client";
import { CheckCircle, Circle, LoaderCircle, AlertTriangle } from "lucide-react";
import type { Job } from "../types";
import {
  pipelineIndex,
  processingSteps,
  percentage,
  completedWithIssues,
} from "../processing-state";
import { ClipProcessingCard, ProcessingProgress } from "./ClipProcessingCard";
import { GeneratedClipCard } from "./GeneratedClipCard";
import { formatRemainingTime } from "../format-eta";
import { getJobDisplayTitle } from "@/features/dashboard/utils";

export function JobProcessingView({ job }: { job: Job }) {
  const stopped = job.status === "cancelling" || job.status === "cancelled";
  const current = pipelineIndex(job);
  const issues = completedWithIssues(job);
  const failed = job.status === "failed" && !issues;
  const clips = job.clips ?? [];
  const highlights = job.highlights ?? [];
  const ready = clips.filter((clip) => clip.status === "completed").length;
  const failedCount = clips.filter((clip) => clip.status === "failed").length;
  const total = job.render?.total ?? Math.max(clips.length, highlights.length);
  const totalSeconds = clips.reduce(
    (sum, clip) => sum + Math.max(0.001, clip.endTime - clip.startTime),
    0,
  );
  const completedSeconds = clips
    .filter((clip) => clip.status === "completed")
    .reduce(
      (sum, clip) => sum + Math.max(0.001, clip.endTime - clip.startTime),
      0,
    );
  const progress = stopped
    ? totalSeconds
      ? Math.floor((100 * completedSeconds) / totalSeconds)
      : 0
    : percentage(job.progressPercent);
  // Queue capacity and queued work are not exposed: only use an authoritative API estimate.
  const eta =
    job.status === "cutting_clips"
      ? formatRemainingTime(job.estimatedRemainingSeconds)
      : null;
  return (
    <section
      aria-label="Video processing"
      className="space-y-5 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs sm:p-6"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          {stopped
            ? job.status === "cancelling"
              ? "Cancelling processing…"
              : "Processing cancelled"
            : issues
              ? "Completed with issues"
              : failed
                ? "Processing stages"
                : "Creating your clips"}
        </h2>
        {!failed && (
          <p className="break-words text-sm text-muted-foreground">
            {getJobDisplayTitle(job, 70)}
          </p>
        )}
        {progress !== undefined && !failed && (
          <ProcessingProgress value={progress} label="Overall progress" />
        )}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <p>
              {ready} of {total} clips ready
              {failedCount ? " · " + failedCount + " failed" : ""}
            </p>
            {eta && (
              <span className="ml-auto text-right tabular-nums">{eta}</span>
            )}
          </div>
        )}
      </div>
      {failed && current < 0 && (
        <p role="status" className="text-sm text-destructive">
          Processing stopped. The failed stage wasn’t reported.
        </p>
      )}
      {job.cancellationPendingReason && (
        <p role="status" className="text-sm text-muted-foreground">
          Worker shutdown is still awaiting confirmation. Use “Check
          cancellation” in the video menu to check again. If this remains
          pending, contact support to verify that the worker has stopped.
        </p>
      )}
      <ol className={failed ? "space-y-3" : "space-y-5"}>
        {processingSteps.map((step, index) => {
          const state = stopped
            ? "stopped"
            : index < current
              ? "completed"
              : index === current
                ? failed
                  ? "failed"
                  : "active"
                : "upcoming";
          const Icon =
            state === "completed"
              ? CheckCircle
              : state === "failed"
                ? AlertTriangle
                : state === "active"
                  ? LoaderCircle
                  : Circle;
          return (
            <li
              key={step.status}
              aria-current={state === "active" ? "step" : undefined}
              className={
                index === 3
                  ? "flex min-w-0 flex-wrap gap-3"
                  : "flex min-w-0 gap-3"
              }
            >
              <Icon
                aria-hidden="true"
                className={
                  "mt-0.5 h-5 w-5 shrink-0 " +
                  (state === "active"
                    ? "text-primary animate-spin motion-reduce:animate-none"
                    : state === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground")
                }
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3
                    className={
                      "text-sm font-medium " +
                      (state === "active" ? "text-primary" : "")
                    }
                  >
                    {step.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {state === "stopped"
                      ? "Stopped"
                      : state === "upcoming"
                        ? failed
                          ? current < 0
                            ? "Pending"
                            : "Not started"
                          : "Upcoming"
                        : state === "active"
                          ? "In progress"
                          : state === "failed"
                            ? "Failed"
                            : issues && index === 3
                              ? "Completed with issues"
                              : "Completed"}
                  </span>
                </div>
              </div>
              {index === 3 && total > 0 && (
                <div className="grid w-full min-w-0 grid-cols-1 items-start gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                  {clips.map((clip, clipIndex) =>
                    clip.status === "completed" ? (
                      <GeneratedClipCard
                        key={clip._id || clip.id}
                        job={job}
                        clip={clip}
                        highlight={highlights[clipIndex]}
                        clipIndex={clipIndex}
                      />
                    ) : (
                      <ClipProcessingCard
                        key={clip._id || clip.id}
                        job={job}
                        clip={clip}
                        highlight={highlights[clipIndex]}
                        index={clipIndex}
                      />
                    ),
                  )}
                  {clips.length === 0 &&
                    highlights.map((highlight, clipIndex) => (
                      <ClipProcessingCard
                        key={clipIndex}
                        job={job}
                        highlight={highlight}
                        index={clipIndex}
                      />
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!failed && (
        <p className="text-xs text-muted-foreground">
          {stopped
            ? job.status === "cancelling"
              ? "Waiting for workers to confirm shutdown. Finished clips are kept. Deletion becomes available when processing has stopped. If shutdown cannot be confirmed, cancellation stays pending; you can safely check again later."
              : "Finished clips are kept. You can now delete this video from its actions menu."
            : issues
              ? "Finished clips are ready to use. Retry any failed clip above to finish creating it."
              : "You can leave this page while your video processes. Finished clips will appear here automatically."}
        </p>
      )}
    </section>
  );
}

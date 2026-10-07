"use client";
import { CheckCircle, Circle, LoaderCircle, AlertTriangle } from "lucide-react";
import type { Job } from "../types";
import {
  pipelineIndex,
  processingSteps,
  percentage,
} from "../processing-state";
import { ClipProcessingCard, ProcessingProgress } from "./ClipProcessingCard";
import { GeneratedClipCard } from "./GeneratedClipCard";
import { getJobDisplayTitle } from "@/features/dashboard/utils";

export function JobProcessingView({ job }: { job: Job }) {
  const current = pipelineIndex(job);
  const failed = job.status === "failed";
  const clips = job.clips ?? [];
  const highlights = job.highlights ?? [];
  const ready =
    job.render?.ready ??
    clips.filter((clip) => clip.status === "completed").length;
  const total = job.render?.total ?? Math.max(clips.length, highlights.length);
  const progress = percentage(job.progressPercent);
  return (
    <section
      aria-label="Video processing"
      className="space-y-5 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs sm:p-6"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          {failed ? "Processing needs attention" : "Creating your clips"}
        </h2>
        <p className="break-words text-sm text-muted-foreground">
          {getJobDisplayTitle(job, 70)}
        </p>
        {progress !== undefined && !failed && (
          <ProcessingProgress value={progress} label="Overall progress" />
        )}
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {ready} of {total} clips ready
            {job.render?.failed ? " · " + job.render.failed + " failed" : ""}
          </p>
        )}
      </div>
      {failed && current < 0 && (
        <p role="status" className="text-sm text-destructive">
          Processing stopped. The failed stage wasn’t reported.
        </p>
      )}
      <ol className="space-y-5">
        {processingSteps.map((step, index) => {
          const state =
            index < current
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
                    {state === "upcoming"
                      ? "Upcoming"
                      : state === "active"
                        ? "In progress"
                        : state === "failed"
                          ? "Failed"
                          : "Completed"}
                  </span>
                </div>
              </div>
              {index === 3 && total > 0 && (
                <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      <p className="text-xs text-muted-foreground">
        You can leave this page while your video processes. Finished clips will
        appear here automatically.
      </p>
    </section>
  );
}

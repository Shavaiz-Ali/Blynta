"use client";

import { useRef, useState } from "react";
import type { Job } from "../types";
import { useRetryJob } from "../queries";
import { getJobId } from "./helpers";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { toast } from "sonner";

const stages: Record<string, string> = {
  download: "Preparing video",
  pending: "Preparing video",
  source_download: "Preparing video",
  transcription: "Generating transcript",
  transcribing: "Generating transcript",
  highlight_detection: "Finding the best moments",
  detecting_highlights: "Finding the best moments",
  cutting_clips: "Creating your clips",
  rendering: "Creating your clips",
  cutting: "Cutting video",
  captioning: "Adding captions",
  uploading: "Uploading clips",
};

export function FailedStateCard({ job }: { job: Job }) {
  const retry = useRetryJob();
  const submitting = useRef(false);
  const [queued, setQueued] = useState(false);
  const stage = stages[job.errorStage ?? ""];
  const unavailable = Boolean(
    job.deletionRequested || job.cancellationRequestedAt,
  );
  async function handleRetry() {
    if (submitting.current || retry.isPending || queued || unavailable) return;
    submitting.current = true;
    try {
      await retry.mutateAsync(getJobId(job));
      setQueued(true);
      toast.success("Processing queued. Completed stages will be kept.");
    } catch {
      toast.error("Couldn’t retry processing. Please try again in a moment.");
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section
      aria-labelledby="video-failure-heading"
      className="rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-400/80"
        />
        <div className="min-w-0 flex-1">
          <h2 id="video-failure-heading" className="text-base font-semibold">
            Video processing failed
          </h2>
          {stage && (
            <p className="mt-1 text-xs text-muted-foreground">
              Failed during{" "}
              <span className="font-medium text-foreground/90">{stage}</span>
            </p>
          )}
          <p className="mt-3 max-w-prose break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {job.processingFailure?.message ||
              "We couldn’t finish processing this video. Retry processing to continue from the last completed stage."}
          </p>
          <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <AppButton
              size="sm"
              className="h-9 w-full shrink-0 sm:w-auto"
              icon={<RefreshCw aria-hidden="true" className="size-4" />}
              onClick={handleRetry}
              isLoading={retry.isPending}
              disabled={retry.isPending || queued || unavailable}
            >
              {queued ? "Queued for retry" : "Retry processing"}
            </AppButton>
            <p className="text-xs text-muted-foreground">
              {unavailable
                ? "Retry is unavailable while this video is being stopped or deleted."
                : "Completed stages are kept."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

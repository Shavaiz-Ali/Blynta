"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useRetryClip } from "../queries";
import type { Clip, Job } from "../types";

export function FailedClipCard({
  job,
  clip,
  index,
  title,
}: {
  job: Job;
  clip: Clip;
  index: number;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const submitting = useRef(false);
  const retry = useRetryClip();
  const failure = clip.failure;
  const available = failure?.retryAvailable !== false;
  const date = failure?.failedAt ? new Date(failure.failedAt) : undefined;
  const fields = [
    failure?.stage ? ["Failed during", failure.stage] : null,
    failure?.reason && failure.reason !== failure.message
      ? ["Reason", failure.reason]
      : null,
    date && Number.isFinite(date.getTime())
      ? [
          "Failed at",
          date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        ]
      : null,
    failure?.attempt ? ["Attempt", String(failure.attempt)] : null,
    failure?.retryAvailable !== undefined
      ? [
          "Retry availability",
          available ? "Available" : "Original video unavailable",
        ]
      : null,
  ].filter((field): field is string[] => field !== null);
  const handleRetry = async () => {
    if (submitting.current || retry.isPending || !available) return;
    submitting.current = true;
    try {
      await retry.mutateAsync({
        jobId: job._id || job.id,
        clipId: clip._id || clip.id,
      });
      toast.success("Clip queued for retry");
    } catch (error) {
      // Only display known public responses; never render infrastructure errors.
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (
        isAxiosError(error) &&
        error.response?.data?.code === "CLIP_RETRY_PENDING"
      ) {
        toast.info(
          "Retry saved. Processing will resume when the service is available.",
        );
        return;
      }
      toast.error(
        status === 409
          ? "This clip cannot be retried right now. Its status has been refreshed."
          : "Could not submit the retry. Please try again shortly.",
      );
    } finally {
      submitting.current = false;
    }
  };
  return (
    <article
      className="min-w-0 self-start space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs"
      aria-label={`Clip ${index + 1}: failed`}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          Clip {String(index + 1).padStart(2, "0")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
          Failed
        </span>
      </div>
      <p className="line-clamp-2 break-words text-sm font-medium" title={title}>
        {title}
      </p>
      <p className="rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-foreground/85">
        {failure?.message ||
          "This clip stopped before it was ready. Retry to create it again."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <AppButton
          size="sm"
          icon={<RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
          isLoading={retry.isPending}
          disabled={!available || retry.isPending}
          onClick={handleRetry}
        >
          {retry.isPending ? "Submitting…" : "Retry clip"}
        </AppButton>
        {fields.length > 0 && (
          <AppButton
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide details" : "View details"}
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
          </AppButton>
        )}
      </div>
      {fields.length > 0 && (
        <div
          id={detailsId}
          aria-hidden={!expanded}
          inert={!expanded}
          className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <dl className="grid gap-2 pt-1 text-xs">
              {fields.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7rem_1fr] gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd
                    className="min-w-0 break-words leading-relaxed"
                    suppressHydrationWarning={label === "Failed at"}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </article>
  );
}

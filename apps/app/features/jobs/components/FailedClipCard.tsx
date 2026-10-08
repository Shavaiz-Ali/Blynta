"use client";

import { useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useRetryClip } from "../queries";
import {
  ClipCardLayout,
  ClipCardTitle,
  ClipCardDescription,
  ClipCardControls,
  ClipPendingMedia,
} from "./ClipCardLayout";
import { ClipFailureDetailsDialog } from "./ClipFailureDetailsDialog";
import type { Clip, Job, Highlight } from "../types";

export function FailedClipCard({
  job,
  clip,
  index,
  title,
  highlight,
}: {
  job: Job;
  clip: Clip;
  index: number;
  title: string;
  highlight?: Highlight;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const submitting = useRef(false);
  const retry = useRetryClip();
  const failure = clip.failure;
  const cancelled =
    Boolean(job.cancellationRequestedAt) ||
    ["cancelling", "cancelled"].includes(job.status);
  const available =
    !job.deletionRequested &&
    !job.cancellationRequestedAt &&
    !["cancelling", "cancelled"].includes(job.status) &&
    failure?.retryAvailable !== false;
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
          available
            ? "Available"
            : cancelled
              ? "Processing cancelled"
              : job.deletionRequested
                ? "Deletion pending"
                : "Original video unavailable",
        ]
      : null,
  ].filter((field): field is string[] => field !== null);
  const hasDetails = fields.some(
    ([label]) => label !== "Retry availability" || !available,
  );
  const handleRetry = async () => {
    if (submitting.current || retry.isPending || !available) return;
    submitting.current = true;
    try {
      await retry.mutateAsync({
        jobId: job._id || job.id,
        clipId: clip._id || clip.id,
      });
      setDetailsOpen(false);
      toast.success("Clip queued for retry");
    } catch (error) {
      // Only display known public responses; never render infrastructure errors.
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (
        isAxiosError(error) &&
        error.response?.data?.code === "CLIP_RETRY_PENDING"
      ) {
        setDetailsOpen(false);
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
    <>
      <ClipCardLayout
        index={index}
        aria-label={`Clip ${index + 1}: failed`}
        status={"Failed"}
        media={
          <ClipPendingMedia
            job={job}
            clip={clip}
            highlight={highlight}
            label="Clip could not be created"
            icon={
              <AlertTriangle
                aria-hidden="true"
                className="h-5 w-5 text-destructive/80"
              />
            }
          />
        }
        footer={
          <>
            <ClipCardControls>
              <AppButton
                size="sm"
                className="h-9 shrink-0 px-3 text-xs font-medium"
                icon={<RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
                isLoading={retry.isPending}
                disabled={!available || retry.isPending}
                onClick={handleRetry}
              >
                {retry.isPending ? "Submitting…" : "Retry clip"}
              </AppButton>
              {hasDetails && (
                <AppButton
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 px-2 text-xs text-muted-foreground"
                  aria-haspopup="dialog"
                  onClick={() => setDetailsOpen(true)}
                >
                  View details
                </AppButton>
              )}
            </ClipCardControls>
          </>
        }
      >
        <ClipCardTitle>{title}</ClipCardTitle>
        <ClipCardDescription>
          {failure?.message ||
            (cancelled
              ? "This clip failed before processing was cancelled."
              : "This clip stopped before it was ready. Retry to create it again.")}
        </ClipCardDescription>
      </ClipCardLayout>
      {hasDetails && (
        <ClipFailureDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          index={index}
          title={title}
          fields={
            fields.some(([label]) => label === "Reason")
              ? fields
              : [
                  ...fields.filter(([label]) => label === "Failed during"),
                  [
                    "Reason",
                    failure?.message ||
                      "This clip stopped before it was ready.",
                  ],
                  ...fields.filter(([label]) => label !== "Failed during"),
                ]
          }
          available={available}
          pending={retry.isPending}
          onRetry={handleRetry}
        />
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { Job } from "@/features/jobs/types";
import { useRetryJob } from "@/features/jobs/queries";
import { getJobId } from "./helpers";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
} from "@/features/dashboard/utils";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { toast } from "sonner";

interface FailedStateCardProps {
  job: Job;
}

const STAGE_LABELS: Record<string, string> = {
  download: "Downloading the video",
  transcription: "Transcribing audio",
  highlight_detection: "Detecting highlights",
  cutting_clips: "Cutting & captioning clips",
  unknown: "Processing",
};

export function FailedStateCard({ job }: FailedStateCardProps) {
  const retryJob = useRetryJob({
    onSuccess: () => {
      toast.success("Retrying job… resuming from where it stopped");
    },
  });

  const stage = job.errorStage ?? "unknown";
  const jobId = getJobId(job);

  function handleRetry() {
    retryJob.mutate(jobId);
  }

  return (
    <div className="space-y-6">
      {/* Top bar header */}
      <div className="flex items-center gap-3">
        <Link
          href="/my-clips"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
          title="Back to My Clips"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card border border-border shadow-2xs">
          {platformIcon(job.sourcePlatform, "h-5 w-5")}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
            {getJobDisplayTitle(job, 70)}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Started {formatDate(job.createdAt)} · Failed
          </p>
        </div>
      </div>

      {/* Main error card */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">
              This job couldn&apos;t be processed
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {STAGE_LABELS[stage] ?? "Processing"} ran into an error.
            </p>

            <div className="mt-3 rounded-xl bg-card/60 border border-border/70 p-3 sm:p-4 space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Stage
                </span>
                <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
                  {stage}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Error
                </span>
                <p className="text-sm text-destructive/90 break-words mt-0.5">
                  {job.errorMessage || "An unknown error occurred."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <AppButton
                onClick={handleRetry}
                isLoading={retryJob.isPending}
                icon={<RefreshCwIcon className="h-4 w-4" />}
                size="sm"
              >
                Resume from where it stopped
              </AppButton>
              <p className="text-[11px] text-muted-foreground sm:ml-1">
                Skips already-completed stages · same job, same page
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobStatus, useJob, useDeleteJob, useRetryJob } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@blynta/ui";
import { GeneratedClipsGrid } from "./GeneratedClipsGrid";
import { JobProcessingView } from "./JobProcessingView";
import { FailedStateCard } from "./FailedStateCard";
import { SourceVideoDetailsSkeleton } from "./SourceVideoDetailsSkeleton";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
  getJobThumbnail,
  getJobDurationFormatted,
} from "@/features/dashboard/utils";
import {
  ChevronLeftIcon,
  FilmIcon,
  SparklesIcon,
  ClockIcon,
  TrashIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  MoreVerticalIcon,
  AlertTriangleIcon,
} from "@/features/dashboard/icons";
import { AppDropdown } from "@blynta/ui";
import { AppDialog } from "@blynta/ui";
import { AppCard } from "@blynta/ui";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface SourceVideoDetailsProps {
  jobId: string;
}

export function SourceVideoDetails({ jobId }: SourceVideoDetailsProps) {
  const router = useRouter();
  const { data: profile } = useCurrentUser();
  const { data: job, isLoading, error } = useJob(jobId);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const deleteMutation = useDeleteJob();
  const retryMutation = useRetryJob();

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(jobId);
      toast.success("Video and its generated clips deleted");
      setDeleteOpen(false);
      router.push("/my-clips");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete video";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async () => {
    try {
      toast.info("Resuming video processing...");
      await retryMutation.mutateAsync(jobId);
      toast.success("Job re-queued successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retry job";
      toast.error(msg);
    }
  };

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        <Link
          href="/my-clips"
          className="hover:text-foreground transition-colors flex items-center gap-1 font-medium shrink-0"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          <span>Clips</span>
        </Link>
        <span>/</span>
        <span className="truncate max-w-[200px] sm:max-w-[320px] font-semibold text-foreground">
          {job ? getJobDisplayTitle(job, 40) : "Loading..."}
        </span>
      </div>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <SourceVideoDetailsSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !job) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <div className="rounded-2xl border border-destructive/30 bg-card p-10 text-center shadow-sm max-w-lg mx-auto my-12">
          <AlertTriangleIcon className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">
            This video is no longer available
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message ||
              "The video you requested was not found or has been deleted."}
          </p>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => router.push("/my-clips")}
            className="mt-4"
          >
            Back to Clips Library
          </AppButton>
        </div>
      </DashboardLayout>
    );
  }

  const duration = getJobDurationFormatted(job);
  const clipsCount = job.clips?.length ?? 0;
  const isEarlyProcessing =
    job.status === JobStatus.PENDING ||
    job.status === JobStatus.TRANSCRIBING ||
    job.status === JobStatus.DETECTING_HIGHLIGHTS;
  const isCuttingClips = job.status === JobStatus.CUTTING_CLIPS;
  const isCompleted = job.status === JobStatus.COMPLETED;
  const isFailed = job.status === JobStatus.FAILED;
  const thumbnail = getJobThumbnail(job);
  const totalHighlightsCount = job.highlights?.length || 6;

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* ── Level 2: Media Detail Header Lockup ── */}
      <div className="flex flex-col gap-4 pb-7 border-b border-border/60">
        {/* Back Link */}
        <div>
          <Link
            href="/my-clips"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Clips</span>
          </Link>
        </div>

        {/* Source Media Banner Container */}
        <AppCard
          className="gap-0 overflow-hidden p-0!"
          contentClassName="flex flex-col p-0! lg:flex-row lg:items-stretch"
          useDefaultClasses={false}
        >
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch">
            {/* 16:9 Thumbnail */}
            <div className="relative aspect-video w-full shrink-0 overflow-hidden border-b border-border/70 bg-muted/40 select-none sm:aspect-auto sm:w-56 sm:min-h-32 sm:border-r sm:border-b-0">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={job.videoTitle || "Source video"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted/20 text-muted-foreground">
                  <FilmIcon className="h-7 w-7 text-primary/60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-medium text-white border border-white/10">
                {duration}
              </div>
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-semibold uppercase">
                {platformIcon(job.sourcePlatform, "h-3 w-3")}
                <span>{job.sourcePlatform}</span>
              </div>
            </div>

            {/* Video metadata details */}
            <div className="min-w-0 flex-1 space-y-2 px-4 py-3 sm:self-center sm:px-5">
              <div className="flex items-center gap-2 flex-wrap">
                {isCompleted ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold"
                  >
                    <SparklesIcon className="h-3 w-3" />
                    <span>Completed</span>
                  </Badge>
                ) : isCuttingClips ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-primary/15 text-primary border-primary/30 text-[11px] font-semibold"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                    </span>
                    <span>
                      Cutting &amp; Captioning ({clipsCount}/
                      {totalHighlightsCount} ready)
                    </span>
                  </Badge>
                ) : isEarlyProcessing ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold"
                  >
                    <ClockIcon className="h-3 w-3 animate-spin" />
                    <span>Processing ({job.progressPercent || 0}%)</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="destructive"
                    className="gap-1 text-[11px] font-semibold"
                  >
                    <AlertTriangleIcon className="h-3 w-3" />
                    <span>Processing Failed</span>
                  </Badge>
                )}

                <span className="text-xs text-muted-foreground">
                  Processed on {formatDate(job.createdAt)}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-foreground line-clamp-1 leading-snug max-w-xl">
                {getJobDisplayTitle(job, 90)}
              </h2>

              {/* Compact Stat Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <div className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">
                    Duration:
                  </span>
                  <span className="font-mono text-foreground font-semibold">
                    {duration}
                  </span>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">
                    Generated Shorts:
                  </span>
                  <span className="font-mono text-primary font-bold">
                    {clipsCount}
                  </span>
                </div>

                {job.videoUploader && (
                  <div className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5 truncate max-w-[200px]">
                    <span className="text-[11px] font-medium text-foreground">
                      Channel:
                    </span>
                    <span className="text-foreground truncate">
                      {job.videoUploader}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Menu */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 px-4 py-3 lg:border-t-0 lg:border-l lg:self-stretch">
            {isFailed && (
              <AppButton
                variant="default"
                size="sm"
                onClick={handleRetry}
                icon={<RefreshCwIcon className="h-3.5 w-3.5" />}
                className="h-8 text-xs font-semibold"
              >
                Retry Processing
              </AppButton>
            )}

            {job.sourceUrl && (
              <AppButton
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(job.sourceUrl, "_blank", "noopener,noreferrer")
                }
                icon={<ExternalLinkIcon className="h-3.5 w-3.5" />}
                className="h-8 text-xs font-medium"
              >
                Original Video
              </AppButton>
            )}

            <AppDropdown
              trigger={
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg flex items-center justify-center border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                  aria-label="Video actions"
                >
                  <MoreVerticalIcon className="h-4 w-4" />
                </button>
              }
              items={[
                ...(job.sourceUrl
                  ? [
                      {
                        label: "Open Source Link",
                        icon: <ExternalLinkIcon className="h-3.5 w-3.5" />,
                        onClick: () =>
                          window.open(
                            job.sourceUrl,
                            "_blank",
                            "noopener,noreferrer",
                          ),
                      },
                    ]
                  : []),
                ...(isFailed
                  ? [
                      {
                        label: "Retry Pipeline",
                        icon: (
                          <RefreshCwIcon className="h-3.5 w-3.5 text-primary" />
                        ),
                        onClick: handleRetry,
                      },
                    ]
                  : []),
                {
                  label: "Delete Video & Clips",
                  icon: <TrashIcon className="h-3.5 w-3.5" />,
                  onClick: () => setDeleteOpen(true),
                  destructive: true,
                  separatorBefore: true,
                },
              ]}
            />
          </div>
        </AppCard>
      </div>

      {/* ── Level 2 Main Body ── */}
      {isEarlyProcessing ? (
        /* Stages 1-3: Downloading, Transcribing, AI Highlight Detection */
        <div className="py-2">
          <JobProcessingView job={job} />
        </div>
      ) : isFailed ? (
        /* Failed state with retry */
        <div className="py-4">
          <FailedStateCard job={job} />
        </div>
      ) : (
        /* Stage 4 (Cutting & Captioning) and Completed Stage: Live Shorts Grid */
        <div className="space-y-6 pt-1">
          {/* Live Cutting Notice Banner when in Stage 4 */}
          {isCuttingClips && (
            <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/60 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <FilmIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      Preparing your clips
                    </h4>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {clipsCount} of {totalHighlightsCount} ready
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;re formatting vertical video and captions. Finished
                    clips appear below automatically.
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-48 shrink-0">
                <div className="h-1.5 flex-1 sm:w-36 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(
                        10,
                        Math.round(
                          (clipsCount / Math.max(1, totalHighlightsCount)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <span className="w-9 text-right text-xs font-semibold tabular-nums text-foreground">
                  {Math.round(
                    (clipsCount / Math.max(1, totalHighlightsCount)) * 100,
                  )}
                  %
                </span>
              </div>
            </div>
          )}

          {/* Section Heading for Completed or Cutting Stage */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Your clips
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isCuttingClips
                  ? `${clipsCount} ready now. ${Math.max(0, totalHighlightsCount - clipsCount)} still processing.`
                  : `${clipsCount} ${clipsCount === 1 ? "clip" : "clips"} generated from this video.`}
              </p>
            </div>
          </div>

          <GeneratedClipsGrid job={job} />
        </div>
      )}

      {/* Delete Video & Clips Modal */}
      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Source Video & Clips"
        description={`Are you sure you want to delete "${getJobDisplayTitle(job, 50)}"? This will permanently delete this video along with all ${clipsCount} generated shorts and stored media files.`}
        footer={
          <>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              icon={<TrashIcon className="h-3.5 w-3.5" />}
            >
              Delete Everything
            </AppButton>
          </>
        }
      />
    </DashboardLayout>
  );
}

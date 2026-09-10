"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobStatus, useJob, useDeleteJob, useRetryJob } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { GeneratedClipsGrid } from "./GeneratedClipsGrid";
import { JobProcessingView } from "./JobProcessingView";
import { FailedStateCard } from "./FailedStateCard";
import { JobDetailSkeleton } from "./JobDetailSkeleton";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
  getJobThumbnail,
  getJobDurationFormatted,
  isProcessingStatus,
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
import { AppDropdown } from "@/components/common/AppDropdown";
import { AppDialog } from "@/components/common/AppDialog";
import { AppCard } from "@/components/common/AppCard";
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
        <JobDetailSkeleton />
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
            {error?.message || "The video you requested was not found or has been deleted."}
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
  const isProcessing = isProcessingStatus(job.status);
  const isCompleted = job.status === JobStatus.COMPLETED;
  const isFailed = job.status === JobStatus.FAILED;
  const thumbnail = getJobThumbnail(job);

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* ── Level 2: Media Detail Header Lockup ── */}
      <div className="flex flex-col gap-6 pb-6 border-b border-border/70">
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
        <AppCard className="gap-5" useDefaultClasses={true}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
            {/* 16:9 Thumbnail */}
            <div className="relative h-24 w-40 sm:h-28 sm:w-48 rounded-lg bg-muted/40 overflow-hidden shrink-0 border border-border/70 select-none shadow-xs">
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
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {isCompleted ? (
                  <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold">
                    <SparklesIcon className="h-3 w-3" />
                    <span>Completed</span>
                  </Badge>
                ) : isProcessing ? (
                  <Badge variant="outline" className="gap-1 bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold">
                    <ClockIcon className="h-3 w-3 animate-spin" />
                    <span>Processing ({job.progressPercent || 0}%)</span>
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
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
                  <span className="text-[11px] font-medium text-foreground">Duration:</span>
                  <span className="font-mono text-foreground font-semibold">{duration}</span>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">Generated Shorts:</span>
                  <span className="font-mono text-primary font-bold">{clipsCount}</span>
                </div>

                {job.videoUploader && (
                  <div className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground flex items-center gap-1.5 truncate max-w-[200px]">
                    <span className="text-[11px] font-medium text-foreground">Channel:</span>
                    <span className="text-foreground truncate">{job.videoUploader}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Menu */}
          <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
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
                onClick={() => window.open(job.sourceUrl, "_blank", "noopener,noreferrer")}
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
                      onClick: () => window.open(job.sourceUrl, "_blank", "noopener,noreferrer"),
                    },
                  ]
                  : []),
                ...(isFailed
                  ? [
                    {
                      label: "Retry Pipeline",
                      icon: <RefreshCwIcon className="h-3.5 w-3.5 text-primary" />,
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
      {isProcessing ? (
        /* Live pipeline processing view */
        <div className="py-2">
          <JobProcessingView job={job} />
        </div>
      ) : isFailed ? (
        /* Failed state with retry */
        <div className="py-4">
          <FailedStateCard job={job} />
        </div>
      ) : (
        /* Completed Generated Clips Grid */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Generated Shorts
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {clipsCount} viral short {clipsCount === 1 ? "clip" : "clips"} extracted from this long-form video.
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

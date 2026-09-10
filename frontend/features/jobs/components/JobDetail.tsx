"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { JobStatus, useJob, useDeleteClip } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { isProcessingStatus } from "@/features/dashboard/utils";
import { AlertTriangleIcon, FilmIcon } from "@/features/dashboard/icons";

import { getClipId, getJobId } from "./helpers";
import { JobProcessingView } from "./JobProcessingView";
import { StudioTopBar } from "./StudioTopBar";
import { StudioLeftPanel } from "./StudioLeftPanel";
import { StudioCenterPanel } from "./StudioCenterPanel";
import { StudioRightPanel } from "./StudioRightPanel";
import { VideoMetadataKit } from "./VideoMetadataKit";
import { CaptionStylingCard } from "./CaptionStylingCard";
import { FailedStateCard } from "./FailedStateCard";
import { JobDetailSkeleton } from "./JobDetailSkeleton";

// Re-exports for backwards compatibility
export { PipelineStepper } from "./PipelineStepper";
export { FailedStateCard } from "./FailedStateCard";
export { JobDetailSkeleton } from "./JobDetailSkeleton";
export { VideoMetadataKit } from "./VideoMetadataKit";

/* -------------------------------------------------------------------------- */
/*                      JobDetailContent (client component)                   */
/* -------------------------------------------------------------------------- */

export function JobDetailContent({ jobId }: { jobId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: profile } = useCurrentUser();
  const { data: job, isLoading, error } = useJob(jobId);
  const deleteClipMutation = useDeleteClip();

  const [activeClipIndex, setActiveClipIndex] = React.useState(0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Sync with clip query param if provided
  React.useEffect(() => {
    if (!job?.clips) return;
    const clipParam = searchParams.get("clip");
    if (clipParam) {
      const idx = job.clips.findIndex((c) => getClipId(c) === clipParam);
      if (idx >= 0) {
        requestAnimationFrame(() => {
          setActiveClipIndex(idx);
        });
      }
    }
  }, [job?.clips, searchParams]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center">
      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  if (error && !job) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8">
          <FailedErrorInline message={(error as Error).message} />
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading || !job) {
    return (
      <DashboardLayout headerContent={headerContent}>
        <JobDetailSkeleton />
      </DashboardLayout>
    );
  }

  const completedClips =
    job.clips?.filter((c) => c.status === JobStatus.COMPLETED) ?? [];
  const isJobComplete = job.status === JobStatus.COMPLETED;
  const isJobProcessing = isProcessingStatus(job.status);
  const isJobFailed = job.status === JobStatus.FAILED;

  const safeClipIndex = Math.min(
    Math.max(0, activeClipIndex),
    Math.max(0, completedClips.length - 1)
  );
  const activeClip = completedClips[safeClipIndex];
  const activeHighlight = job.highlights?.[safeClipIndex];

  function handleDeleteActiveClip() {
    if (!job || !activeClip) return;
    const clipId = getClipId(activeClip);
    deleteClipMutation.mutate(
      { jobId: getJobId(job), clipId },
      {
        onSuccess: () => {
          toast.success("Clip deleted.");
          setDeleteOpen(false);
          setActiveClipIndex(0);
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to delete clip.");
          setDeleteOpen(false);
        },
      }
    );
  }

  return (
    <DashboardLayout headerContent={headerContent}>
      {/* Processing State: Show only when processing AND no completed clips are ready yet */}
      {isJobProcessing && completedClips.length === 0 && <JobProcessingView job={job} />}

      {/* Failed State Card */}
      {isJobFailed && completedClips.length === 0 && <FailedStateCard job={job} />}

      {/* Studio View: Show as soon as clips start getting generated or job completes */}
      {completedClips.length > 0 && activeClip && (
        <div className="space-y-6">
          {/* Top Bar with Clip Selector Tabs */}
          <StudioTopBar
            job={job}
            activeClipIndex={safeClipIndex}
            onSelectClip={(idx) => setActiveClipIndex(idx)}
          />

          {/* Two-Column Studio Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
            {/* Left: Video Player + Caption Styling card beneath it */}
            <div className="lg:col-span-5 order-1 flex flex-col items-center gap-4">
              <StudioCenterPanel
                jobId={getJobId(job)}
                clip={activeClip}
                job={job}
                onDeleteClip={() => setDeleteOpen(true)}
              />
              {/* Caption Styling sits below the player to fill the left column height */}
              <div className="w-full max-w-[420px]">
                <CaptionStylingCard />
              </div>
            </div>

            {/* Right: Viral Intelligence + Clip Details stacked */}
            <div className="lg:col-span-7 order-2 flex flex-col gap-4 min-w-0">
              <StudioLeftPanel
                job={job}
                activeHighlight={activeHighlight}
                activeClip={activeClip}
              />
              <StudioRightPanel
                job={job}
                clip={activeClip}
                highlight={activeHighlight}
                clipIndex={safeClipIndex}
                onDeleteClip={() => setDeleteOpen(true)}
              />
            </div>
          </div>

          {/* AI SEO & Social Growth Kit (Description, Keywords, Hashtags) */}
          <VideoMetadataKit
            job={job}
            activeHighlight={activeHighlight}
            clipIndex={safeClipIndex}
          />
        </div>
      )}

      {/* Completed job but 0 completed clips */}
      {isJobComplete && completedClips.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <FilmIcon className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            No clips generated for this job
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            The AI was unable to detect any high-confidence viral moments in this video.
          </p>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="mt-2"
          >
            Try another video
          </AppButton>
        </div>
      )}

      {/* Delete Clip Confirmation Dialog */}
      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        size="sm"
        title="Delete this clip?"
        description="This will permanently delete this clip from storage. This cannot be undone."
        footer={
          <div className="flex w-full gap-2 justify-end">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteClipMutation.isPending}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              size="sm"
              isLoading={deleteClipMutation.isPending}
              onClick={handleDeleteActiveClip}
            >
              Delete Clip
            </AppButton>
          </div>
        }
      />
    </DashboardLayout>
  );
}

function FailedErrorInline({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-2xs">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Couldn&apos;t load this job
          </h3>
          <p className="mt-1 text-xs text-muted-foreground break-words">
            {message || "It may not exist or you don&apos;t have permission to view it."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default JobDetailContent;
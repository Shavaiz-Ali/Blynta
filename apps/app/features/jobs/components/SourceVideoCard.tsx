"use client";
import { useRouter } from "next/navigation";
import { Job, JobStatus } from "@/features/jobs";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
  getJobThumbnail,
  getJobDurationFormatted,
  isProcessingStatus,
} from "@/features/dashboard/utils";
import { JobActionsMenu } from "@/features/dashboard/components/JobActionsMenu";
import {
  SparklesIcon,
  ClockIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@blynta/ui";
import { Badge } from "@/components/ui/badge";
import { ClipLibraryCard, ClipLibraryThumbnail } from "./ClipLibraryCard";
export function SourceVideoCard({
  job,
  viewMode = "grid",
}: {
  job: Job;
  viewMode?: "grid" | "list";
}) {
  const router = useRouter();
  const jobId = job._id || job.id;
  const clipsCount = job.clips?.length ?? 0;
  const isProcessing = isProcessingStatus(job.status);
  const list = viewMode === "list";
  const open = () => router.push(`/my-clips/${jobId}`);
  const status =
    job.status === JobStatus.COMPLETED ? (
      <Badge
        variant="secondary"
        className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold gap-1"
      >
        <SparklesIcon className="h-3 w-3" />
        <span>
          {clipsCount} {clipsCount === 1 ? "clip" : "clips"} generated
        </span>
      </Badge>
    ) : isProcessing ? (
      <Badge
        variant="secondary"
        className="bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold gap-1"
      >
        <ClockIcon className="h-3 w-3 animate-spin" />
        <span>
          {list ? `Processing (${job.progressPercent || 0}%)` : "Processing..."}
        </span>
      </Badge>
    ) : (
      <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
        <AlertTriangleIcon className="h-3 w-3" />
        <span>Failed</span>
      </Badge>
    );
  return (
    <ClipLibraryCard
      viewMode={viewMode}
      onClick={open}
      className={
        isProcessing ? "border-chart-4/30 bg-chart-4/[0.02]" : undefined
      }
      thumbnail={
        <ClipLibraryThumbnail
          viewMode={viewMode}
          thumbnail={getJobThumbnail(job)}
          title={job.videoTitle || "Source video"}
          duration={getJobDurationFormatted(job)}
          platform={job.sourcePlatform}
          platformIcon={platformIcon(job.sourcePlatform, "h-3 w-3")}
          hoverLabel="View clips"
          progress={isProcessing ? job.progressPercent || 0 : undefined}
        />
      }
      title={getJobDisplayTitle(job, list ? 70 : 65)}
      metadata={
        <>
          <span>{formatDate(job.createdAt)}</span>
          {job.videoUploader && (
            <>
              <span>•</span>
              <span
                className={
                  list ? "truncate max-w-[140px]" : "truncate max-w-[120px]"
                }
              >
                {job.videoUploader}
              </span>
            </>
          )}
        </>
      }
      status={status}
      actions={
        <>
          {list && (
            <AppButton
              variant="outline"
              size="sm"
              onClick={open}
              icon={<ArrowRightIcon className="h-3.5 w-3.5" />}
              iconPosition="right"
              className="h-8 text-xs font-semibold hover:border-primary hover:text-primary shadow-2xs"
            >
              View clips
            </AppButton>
          )}
          <JobActionsMenu job={job} menuPlacement={list ? "bottom" : "top"} />
        </>
      }
    />
  );
}

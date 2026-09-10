"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Job, JobStatus } from "@/features/jobs";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  platformIcon,
  getJobDisplayTitle,
  formatDate,
  getJobThumbnail,
  getJobDurationFormatted,
  isProcessingStatus,
} from "../utils";
import { JobActionsMenu } from "./JobActionsMenu";
import {
  FilmIcon,
  ClockIcon,
  SparklesIcon,
} from "../icons";

import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";

interface JobCardListProps {
  job: Job;
}

export function JobCardList({ job }: JobCardListProps) {
  const router = useRouter();
  const [imgError, setImgError] = React.useState(false);

  const thumbnail = !imgError ? getJobThumbnail(job) : null;
  const duration = getJobDurationFormatted(job);
  const clipsCount = job.clips?.length ?? 0;
  const isProcessing = isProcessingStatus(job.status);
  const isCompleted = job.status === JobStatus.COMPLETED;
  const isFailed = job.status === JobStatus.FAILED;

  const handleRowClick = () => {
    router.push(`/my-clips/${job._id || job.id}`);
  };

  return (
    <AppCard
      onClick={handleRowClick}
      className={cn(
        "group relative flex items-center justify-between gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-200 cursor-pointer rounded-lg",
        isProcessing && "border-chart-4/30 bg-chart-4/[0.02]"
      )}
    >
      {/* ── Left side: 16:9 mini-thumbnail + Info ── */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Compact Thumbnail Container */}
        <div className="relative h-14 sm:h-16 w-24 sm:w-28 shrink-0 rounded-lg overflow-hidden bg-muted/40 border border-border/60 select-none">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={job.videoTitle || "Thumbnail"}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-card">
              <FilmIcon className="h-5 w-5 text-muted-foreground/60" />
            </div>
          )}
          {/* Duration tag */}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white/90">
            {duration}
          </span>
        </div>

        {/* Title and metadata */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0">{platformIcon(job.sourcePlatform, "h-3.5 w-3.5")}</span>
            <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {getJobDisplayTitle(job, 80)}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="capitalize">{job.sourcePlatform}</span>
            <span>·</span>
            <span>{duration}</span>
            <span>·</span>
            <span>{formatDate(job.createdAt)}</span>
            {isCompleted && clipsCount > 0 && (
              <>
                <span>·</span>
                <span className="text-primary font-medium inline-flex items-center gap-1">
                  <SparklesIcon className="h-3 w-3" />
                  {clipsCount} {clipsCount === 1 ? "clip" : "clips"} generated
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Right side: Status + Actions ── */}
      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Status Pill */}
        {isCompleted ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ready
          </Badge>
        ) : isProcessing ? (
          <Badge variant="secondary" className="bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold gap-1">
            <ClockIcon className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
            Failed
          </Badge>
        )}

        {/* Action Menu with delete confirmation */}
        <JobActionsMenu job={job} menuPlacement="bottom" />
      </div>
    </AppCard>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Job, JobStatus } from "@/features/jobs";
import { cn } from "@/lib/utils";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
  getJobThumbnail,
  getJobDurationFormatted,
  isProcessingStatus,
} from "../utils";
import { JobActionsMenu } from "./JobActionsMenu";
import { FilmIcon, ClockIcon, SparklesIcon } from "../icons";

import { AppCard } from "@blynta/ui";
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

  const handleRowClick = () => {
    router.push(`/my-clips/${job._id || job.id}`);
  };

  return (
    <AppCard
      onClick={handleRowClick}
      useDefaultClasses={false}
      contentClassName="flex flex-col p-0! sm:flex-row sm:items-stretch"
      className={cn(
        "group relative gap-0 cursor-pointer overflow-hidden rounded-xl p-0! transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/35 hover:bg-card/90 hover:shadow-sm",
        isProcessing && "border-chart-4/30 bg-chart-4/[0.02]",
      )}
    >
      {/* ── Left side: 16:9 mini-thumbnail + Info ── */}
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch">
        {/* Compact Thumbnail Container */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden border-b border-border/60 bg-muted/40 select-none sm:aspect-auto sm:w-44 sm:min-h-24 sm:border-r sm:border-b-0">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={job.videoTitle || "Thumbnail"}
              onError={() => setImgError(true)}
              fill
              unoptimized
              sizes="176px"
              className="object-cover transition-[transform,filter] duration-300 group-hover:scale-[1.015] group-hover:brightness-95"
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
        <div className="min-w-0 flex-1 space-y-1 px-4 py-3 sm:self-center">
          <div className="flex items-center gap-2">
            <span className="shrink-0">
              {platformIcon(job.sourcePlatform, "h-3.5 w-3.5")}
            </span>
            <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
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
      <div
        className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 px-4 py-3 sm:border-t-0 sm:pl-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status Pill */}
        {isCompleted ? (
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold gap-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ready
          </Badge>
        ) : isProcessing ? (
          <Badge
            variant="secondary"
            className="bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold gap-1"
          >
            <ClockIcon className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        ) : (
          <Badge
            variant="destructive"
            className="text-[11px] font-semibold gap-1"
          >
            Failed
          </Badge>
        )}

        {/* Action Menu with delete confirmation */}
        <JobActionsMenu job={job} menuPlacement="bottom" />
      </div>
    </AppCard>
  );
}

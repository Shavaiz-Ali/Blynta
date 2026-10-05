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
import { FilmIcon, PlayIcon, SparklesIcon, ClockIcon } from "../icons";

import { AppMediaCard } from "@blynta/ui";
import { Badge } from "@/components/ui/badge";

interface JobCardGridProps {
  job: Job;
}

export function JobCardGrid({ job }: JobCardGridProps) {
  const router = useRouter();
  const [imgError, setImgError] = React.useState(false);

  const thumbnail = !imgError ? getJobThumbnail(job) : null;
  const duration = getJobDurationFormatted(job);
  const clipsCount = job.clips?.length ?? 0;
  const isProcessing = isProcessingStatus(job.status);
  const isCompleted = job.status === JobStatus.COMPLETED;
  const handleCardClick = () => {
    router.push(`/my-clips/${job._id || job.id}`);
  };

  return (
    <AppMediaCard
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl p-0 text-left transition-[border-color,box-shadow,background-color] duration-200",
        "cursor-pointer hover:border-primary/35 hover:bg-card/90 hover:shadow-md hover:shadow-black/10",
        isProcessing && "border-chart-4/30 bg-chart-4/[0.02]",
      )}
      useDefaultClasses={false}
      contentClassName="p-0"
    >
      {/* ── 16:9 Thumbnail Container ── */}
      <div className="relative aspect-video w-full bg-muted/40 overflow-hidden select-none">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={job.videoTitle || "Video thumbnail"}
            onError={() => setImgError(true)}
            fill
            unoptimized
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-[transform,filter] duration-300 group-hover:scale-[1.015] group-hover:brightness-90"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-1">
              <FilmIcon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              No preview
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Platform Badge (Top-Left) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xs">
          {platformIcon(job.sourcePlatform, "h-3 w-3")}
          <span className="text-[10px] font-semibold tracking-wide uppercase">
            {job.sourcePlatform}
          </span>
        </div>

        {/* Duration pill (Bottom-Right) */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-white/90 border border-white/10">
          {duration}
        </div>

        {/* Quiet hover affordance without obscuring the thumbnail. */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-10 w-10 scale-95 items-center justify-center rounded-full border border-white/20 bg-background/90 text-foreground shadow-xl transition-transform duration-200 group-hover:scale-100">
            <PlayIcon className="ml-0.5 h-4 w-4 fill-current" />
          </div>
        </div>

        {/* Live processing pulsating overlay */}
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-chart-4/30 overflow-hidden">
            <div className="h-full bg-chart-4 animate-pulse w-full" />
          </div>
        )}
      </div>

      {/* ── Content Details ── */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {getJobDisplayTitle(job, 65)}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
            <span>{formatDate(job.createdAt)}</span>
            {job.videoUploader && (
              <>
                <span>•</span>
                <span className="truncate max-w-[120px]">
                  {job.videoUploader}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Bottom meta row */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          {/* Clips Extracted Pill / Processing status */}
          {isCompleted ? (
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
              <span>Processing...</span>
            </Badge>
          ) : (
            <Badge
              variant="destructive"
              className="text-[11px] font-semibold gap-1"
            >
              <span>Failed</span>
            </Badge>
          )}

          {/* Three dot context menu with delete confirmation */}
          <JobActionsMenu job={job} menuPlacement="top" />
        </div>
      </div>
    </AppMediaCard>
  );
}

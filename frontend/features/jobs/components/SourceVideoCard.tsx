"use client";

import * as React from "react";
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
} from "@/features/dashboard/utils";
import { JobActionsMenu } from "@/features/dashboard/components/JobActionsMenu";
import {
  FilmIcon,
  PlayIcon,
  SparklesIcon,
  ClockIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";

interface SourceVideoCardProps {
  job: Job;
  viewMode?: "grid" | "list";
}

export function SourceVideoCard({ job, viewMode = "grid" }: SourceVideoCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = React.useState(false);

  const jobId = job._id || job.id;
  const thumbnail = !imgError ? getJobThumbnail(job) : null;
  const duration = getJobDurationFormatted(job);
  const clipsCount = job.clips?.length ?? 0;
  const isProcessing = isProcessingStatus(job.status);
  const isCompleted = job.status === JobStatus.COMPLETED;

  const handleCardClick = () => {
    router.push(`/my-clips/${jobId}`);
  };

  if (viewMode === "list") {
    return (
      <AppCard
        onClick={handleCardClick}
        className={cn(
          "group relative flex flex-col sm:flex-row sm:items-center justify-between  hover:border-primary/40 hover:shadow-sm transition-all duration-200 cursor-pointer gap-4 text-left rounded-lg",
          isProcessing && "border-chart-4/30 bg-chart-4/[0.02]"
        )}
        useDefaultClasses={true}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* 16:9 Thumbnail preview */}
          <div className="relative h-16 w-28 sm:h-20 sm:w-36 rounded-md bg-muted/40 overflow-hidden shrink-0 border border-border/60">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={job.videoTitle || "Source video"}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted/20 text-muted-foreground">
                <FilmIcon className="h-5 w-5" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-medium text-white">
              {duration}
            </div>
            <div className="absolute top-1 left-1 flex items-center px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-semibold uppercase">
              {job.sourcePlatform}
            </div>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {getJobDisplayTitle(job, 70)}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{formatDate(job.createdAt)}</span>
              {job.videoUploader && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[140px]">{job.videoUploader}</span>
                </>
              )}
            </div>
            <div className="pt-0.5 flex items-center gap-2">
              {isCompleted ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold gap-1">
                  <SparklesIcon className="h-3 w-3" />
                  <span>{clipsCount} {clipsCount === 1 ? "clip" : "clips"} generated</span>
                </Badge>
              ) : isProcessing ? (
                <Badge variant="secondary" className="bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold gap-1">
                  <ClockIcon className="h-3 w-3 animate-spin" />
                  <span>Processing ({job.progressPercent || 0}%)</span>
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
                  <AlertTriangleIcon className="h-3 w-3" />
                  <span>Failed</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action button & Menu */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleCardClick}
            icon={<ArrowRightIcon className="h-3.5 w-3.5" />}
            iconPosition="right"
            className="h-8 text-xs font-semibold hover:border-primary hover:text-primary shadow-2xs"
          >
            View clips
          </AppButton>
          <JobActionsMenu job={job} menuPlacement="bottom" />
        </div>
      </AppCard>
    );
  }

  // Grid view (Default)
  return (
    <AppCard
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all duration-50 p-0! px-0!",
        "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer text-left",
        isProcessing && "border-chart-4/30 bg-chart-4/[0.02]"
      )}
      contentClassName="p-0!"
      useDefaultClasses={false}
    >
      {/* ── 16:9 Thumbnail Container ── */}
      <div className="relative aspect-video w-full bg-muted/40 overflow-hidden select-none">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={job.videoTitle || "Source video thumbnail"}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-1">
              <FilmIcon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">No preview</span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

        {/* Platform Badge (Top-Left) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-white shadow-xs">
          {platformIcon(job.sourcePlatform, "h-3 w-3")}
          <span className="text-[10px] font-semibold tracking-wide uppercase">
            {job.sourcePlatform}
          </span>
        </div>

        {/* Duration pill (Bottom-Right) */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-white/90 border border-white/10">
          {duration}
        </div>

        {/* Hover View Clips Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[2px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md transform scale-95 group-hover:scale-100 transition-transform">
            <PlayIcon className="h-3.5 w-3.5 ml-0.5" />
            <span>View clips</span>
          </div>
        </div>

        {/* Live processing progress bar */}
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-chart-4/30 overflow-hidden">
            <div
              className="h-full bg-chart-4 transition-all duration-300"
              style={{ width: `${Math.max(job.progressPercent || 15, 10)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Content Details ── */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {getJobDisplayTitle(job, 65)}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
            <span>{formatDate(job.createdAt)}</span>
            {job.videoUploader && (
              <>
                <span>•</span>
                <span className="truncate max-w-[120px]">{job.videoUploader}</span>
              </>
            )}
          </p>
        </div>

        {/* Bottom meta row */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          {/* Clips Generated Badge / Processing status */}
          {isCompleted ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold gap-1">
              <SparklesIcon className="h-3 w-3" />
              <span>{clipsCount} {clipsCount === 1 ? "clip" : "clips"} generated</span>
            </Badge>
          ) : isProcessing ? (
            <Badge variant="secondary" className="bg-chart-4/15 text-chart-4 border-chart-4/25 text-[11px] font-semibold gap-1">
              <ClockIcon className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
              <AlertTriangleIcon className="h-3 w-3" />
              <span>Failed</span>
            </Badge>
          )}

          {/* Context menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <JobActionsMenu job={job} menuPlacement="top" />
          </div>
        </div>
      </div>
    </AppCard>
  );
}

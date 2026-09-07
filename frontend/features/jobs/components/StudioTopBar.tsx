"use client";

import * as React from "react";
import Link from "next/link";
import { Job, JobStatus } from "@/features/jobs/types";
import { getClipId } from "./helpers";
import {
  STATUS_META,
  platformIcon,
  truncateUrl,
  getJobDisplayTitle,
  formatDate,
  isProcessingStatus,
} from "@/features/dashboard/utils";
import {
  ChevronLeftIcon,
  FilmIcon,
  DownloadIcon,
  Share2Icon,
  CalendarIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { downloadTranscriptAsTxt } from "./TranscriptDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StudioTopBarProps {
  job: Job;
  activeClipIndex: number;
  onSelectClip: (index: number) => void;
  onOpenTranscript?: () => void;
}

function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/70 shrink-0",
        className
      )}
    >
      Soon
    </span>
  );
}

export function StudioTopBar({
  job,
  activeClipIndex,
  onSelectClip,
  onOpenTranscript,
}: StudioTopBarProps) {
  const meta = STATUS_META[job.status] ?? STATUS_META[JobStatus.COMPLETED];
  const completedClips =
    job.clips?.filter((c) => c.status === JobStatus.COMPLETED) ?? [];
  const hasTranscript = Boolean(job.transcript && job.transcript.length > 0);

  function handleDownloadTranscript() {
    if (!job.transcript || job.transcript.length === 0) return;
    const title = getJobDisplayTitle(job, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadTranscriptAsTxt(job.transcript, `transcript-${title}.txt`);
    toast.success("Downloaded transcript (.txt)");
  }

  return (
    <div className="space-y-4 pb-4 border-b border-border/70">
      {/* Top row: Back link + Title + Meta + Quick Actions + Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/my-clips"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
            title="Back to My Clips"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border shadow-2xs">
            {platformIcon(job.sourcePlatform, "h-4.5 w-4.5")}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
              {getJobDisplayTitle(job, 70)}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              <span className="capitalize">{job.sourcePlatform}</span>
              <span>·</span>
              <span className="font-mono text-[11px]">{formatDate(job.createdAt)}</span>
              {job.resolutionUsed && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono text-[10px] font-semibold border border-border/70">
                    {job.resolutionUsed}
                  </span>
                </>
              )}
              <span>·</span>
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/70 hover:text-primary transition-colors truncate max-w-[140px]"
                title={job.sourceUrl}
              >
                {truncateUrl(job.sourceUrl, 30)}
              </a>
            </div>
          </div>
        </div>

        {/* Right Action: Download Transcript Button & Status Chip */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {hasTranscript && (
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleDownloadTranscript}
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
              className="h-7 text-xs px-2.5"
              title="Download Transcript as text (.txt)"
            >
              Transcript
            </AppButton>
          )}

          {/* Status Chip */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shrink-0",
              meta.chip
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isProcessingStatus(job.status) && "animate-pulse",
                meta.dot
              )}
            />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Clip Selector Tabs (Left) & Social/Schedule Toolbar (Right) */}
      {completedClips.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-1">
          {/* Left: Horizontal Clip Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 max-w-full">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60">
              {completedClips.map((c, idx) => {
                const highlight = job.highlights?.[idx];
                const isSelected = activeClipIndex === idx;
                const score =
                  typeof highlight?.score === "number"
                    ? Math.round(highlight.score * 100)
                    : null;

                return (
                  <button
                    key={getClipId(c) || idx}
                    type="button"
                    onClick={() => onSelectClip(idx)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                    )}
                  >
                    <FilmIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>Clip {idx + 1}</span>
                    {score !== null && (
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold",
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {score}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Share & Schedule Actions */}
          <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
            <AppButton
              variant="outline"
              size="sm"
              disabled
              className="h-8 text-xs font-medium text-muted-foreground opacity-60 cursor-not-allowed shadow-2xs gap-1.5"
              icon={<Share2Icon className="h-3.5 w-3.5" />}
              title="Share Preview Link — Coming Soon"
            >
              <span>Share Link</span>
              <SoonBadge />
            </AppButton>

            <AppButton
              variant="outline"
              size="sm"
              disabled
              className="h-8 text-xs font-medium text-muted-foreground opacity-60 cursor-not-allowed shadow-2xs gap-1.5"
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
              title="Push to Scheduled Social Queue — Coming Soon"
            >
              <span>Schedule</span>
              <SoonBadge />
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

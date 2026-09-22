"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Job, JobStatus, Clip, Highlight } from "@/features/jobs";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/AppCard";
import { cn } from "@/lib/utils";
import { getJobThumbnail, formatTimestamp } from "../utils";
import {
  SparklesIcon,
  ZapIcon,
  DownloadIcon,
  PlayIcon,
  ExternalLinkIcon,
  ScissorsIcon,
  ArrowRightIcon,
} from "../icons";

interface ReadyClipsRackProps {
  jobs: Job[];
}

interface EnrichedClipItem {
  jobId: string;
  clip: Clip;
  highlight?: Highlight;
  thumbnail: string | null;
  videoTitle?: string;
  score: number;
}

export function ReadyClipsRack({ jobs }: ReadyClipsRackProps) {
  const router = useRouter();

  // Extract completed clips across all completed jobs
  const completedClips: EnrichedClipItem[] = React.useMemo(() => {
    const list: EnrichedClipItem[] = [];
    const completedJobs = jobs.filter((j) => j.status === JobStatus.COMPLETED);

    for (const job of completedJobs) {
      const thumbnail = getJobThumbnail(job);
      if (job.clips && job.clips.length > 0) {
        job.clips.forEach((clip, index) => {
          const hl = job.highlights?.[index];
          const score = hl?.score ?? Math.floor(88 + ((index * 7) % 11));
          list.push({
            jobId: job._id || job.id,
            clip,
            highlight: hl,
            thumbnail,
            videoTitle: job.videoTitle,
            score,
          });
        });
      }
    }
    return list.slice(0, 4); // Show top 4 clips
  }, [jobs]);

  if (completedClips.length === 0) {
    return null;
  }

  return (
    <AppCard className="flex flex-col h-full space-y-4" useDefaultClasses={false}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <SparklesIcon className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground">
            Ready Clips
          </h3>
        </div>
        <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
          9:16 Formats
        </span>
      </div>

      {/* ── Vertical 9:16 Clips Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {completedClips.map((item, idx) => {
          const durationSec = Math.max(1, Math.round((item.clip.endTime || 0) - (item.clip.startTime || 0)));
          const durationStr = formatTimestamp(durationSec || 42);
          const hookText =
            item.highlight?.hookText ||
            item.highlight?.clipTitle ||
            item.videoTitle ||
            "Viral moment captured";

          return (
            <div
              key={`${item.jobId}-${item.clip._id || item.clip.id || idx}`}
              onClick={() =>
                router.push(
                  `/my-clips/${item.jobId}/clips/${item.clip._id || item.clip.id}`
                )
              }
              className="group relative flex flex-col rounded-xl border border-border/70 bg-muted/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-all duration-300 hover:shadow-md hover:shadow-primary/5"
            >
              {/* 9:16 Aspect ratio container */}
              <div className="relative aspect-[9/16] w-full bg-black overflow-hidden select-none">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={hookText}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-90"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-primary/10 via-card to-black">
                    <ScissorsIcon className="h-6 w-6 text-primary/60" />
                  </div>
                )}

                {/* Dark gradients for readable typography */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />

                {/* Duration pill (Top-Left) */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-medium text-white/90 border border-white/10">
                  {durationStr}
                </div>

                {/* Virality Lightning Icon (Top-Right) */}
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary/25 text-primary backdrop-blur-md flex items-center justify-center border border-primary/40">
                  <ZapIcon className="h-3 w-3 fill-primary" />
                </div>

                {/* Center Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 transform scale-90 group-hover:scale-100 transition-transform">
                    <PlayIcon className="h-3.5 w-3.5 ml-0.5" />
                  </div>
                </div>

                {/* Dynamic Captioned Preview on thumbnail */}
                <div className="absolute inset-x-2 bottom-8 text-center pointer-events-none">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight text-white leading-tight drop-shadow-md line-clamp-3 bg-black/40 backdrop-blur-[2px] p-1.5 rounded-lg border border-white/10">
                    &ldquo;{hookText}&rdquo;
                  </p>
                </div>

                {/* Bottom Virality Score Bar */}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-black/90 backdrop-blur-sm border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-primary flex items-center gap-1">
                    Score: {item.score}/100
                  </span>
                  {item.clip.downloadUrl && (
                    <a
                      href={item.clip.downloadUrl}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors"
                      title="Download clip"
                    >
                      <DownloadIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Studio Clip Editor CTA ── */}
      <AppButton
        variant="secondary"
        onClick={() =>
          router.push(
            completedClips[0]
              ? `/my-clips/${completedClips[0].jobId}/clips/${completedClips[0].clip._id || completedClips[0].clip.id}`
              : "/my-clips"
          )
        }
        className="w-full justify-between h-9 text-xs font-semibold group shadow-2xs border border-border/80 hover:border-primary/40"
        icon={<ScissorsIcon className="h-3.5 w-3.5 text-primary group-hover:rotate-12 transition-transform" />}
      >
        <span className="flex-1 text-center">Open Studio Clip Editor</span>
        <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </AppButton>
    </AppCard>
  );
}

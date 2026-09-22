"use client";

import * as React from "react";
import { Clip, Highlight, Job, JobStatus } from "@/features/jobs";
import { GeneratedClipCard } from "./GeneratedClipCard";
import { AppTabs } from "@/components/common/AppTabs";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect } from "@/components/common/AppSelect";
import {
  FilmIcon,
  SparklesIcon,
  SearchIcon,
  ClockIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface GeneratedClipsGridProps {
  job: Job;
}

type ImpactFilter = "all" | "high" | "medium" | "low";
type SortOption = "score_desc" | "duration_desc" | "time_asc";

/* -------------------------------------------------------------------------- */
/*                 Live Skeleton Card for Clips Being Generated               */
/* -------------------------------------------------------------------------- */

function ClipGeneratingSkeletonCard({
  index,
  highlight,
}: {
  index: number;
  highlight?: Highlight;
}) {
  const score = highlight?.score ? Math.round(highlight.score * 100) : null;
  const title =
    highlight?.clipTitle ||
    highlight?.hookText ||
    `Generating Short #${index + 1}`;
  const style = highlight?.style || "Curiosity Hook";

  return (
    <AppCard
      className={cn(
        "group relative flex flex-col overflow-hidden text-left",
        "border border-primary/40 bg-card animate-pulse transition-all",
        "p-0!"
      )}
      useDefaultClasses={false}
      contentClassName="!p-0 py-0!"
    >
      {/* ── Media Area: same 16:10 box as GeneratedClipCard's thumbnail ── */}
      <div className="relative aspect-[16/10] w-full bg-gradient-to-b from-muted/70 via-primary/5 to-muted/90 flex flex-col items-center justify-between p-3 select-none overflow-hidden">
        {/* Top Badges */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold border border-primary/30 shadow-2xs backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span>Cutting Clip</span>
          </div>

          {score && (
            <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold border border-white/10">
              {score}% Virality
            </span>
          )}
        </div>

        {/* Center Live Processing Graphic (compact to fit the 16:10 box) */}
        <div className="flex flex-col items-center text-center space-y-1.5 my-auto z-10 px-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-10 w-10 rounded-full bg-primary/25 animate-ping opacity-60" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/35 text-primary shadow-md backdrop-blur-xs">
              <FilmIcon className="h-4 w-4 animate-pulse" />
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">
              Cutting &amp; Captioning
            </p>
            <p className="text-[10px] text-muted-foreground">
              Burning 9:16 dynamic subtitles...
            </p>
          </div>
        </div>

        {/* Bottom Shimmer Bar */}
        <div className="w-full space-y-1.5 z-10">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3 animate-spin text-primary" />
              <span>Rendering</span>
            </span>
            <span className="text-primary font-semibold">In Progress</span>
          </div>
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden border border-border/40">
            <div className="h-full bg-primary animate-pulse w-3/4 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Card Content: mirrors GeneratedClipCard body rows ── */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-mono px-1.5 py-0 uppercase"
            >
              Short #{index + 1}
            </Badge>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
              {style}
            </span>
          </div>

          <h4 className="text-sm font-bold text-foreground line-clamp-1 leading-snug">
            {title}
          </h4>

          {/* Two shimmer lines standing in for the clip description (line-clamp-2) */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded bg-muted/70 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>

        {/* Bottom Controls Row */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
          <div className="h-8 w-24 rounded-md bg-muted/80 animate-pulse" />
          <div className="h-8 w-8 rounded-md bg-muted/60 animate-pulse" />
        </div>
      </div>
    </AppCard>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Main GeneratedClipsGrid Component                  */
/* -------------------------------------------------------------------------- */

export function GeneratedClipsGrid({ job }: GeneratedClipsGridProps) {
  const [impactFilter, setImpactFilter] = React.useState<ImpactFilter>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("score_desc");
  const [searchQuery, setSearchQuery] = React.useState("");

  const clips = job.clips ?? [];
  const highlights = job.highlights ?? [];
  const isCuttingClips = job.status === JobStatus.CUTTING_CLIPS;
  const isEarlyProcessing =
    job.status === JobStatus.PENDING ||
    job.status === JobStatus.TRANSCRIBING ||
    job.status === JobStatus.DETECTING_HIGHLIGHTS;

  // Pair each finished clip with its corresponding highlight
  const pairedClips = React.useMemo(() => {
    return clips.map((clip, index) => {
      const highlight =
        highlights[index] ||
        highlights.find(
          (h) =>
            Math.abs(h.startTime - clip.startTime) < 2 ||
            Math.abs(h.endTime - clip.endTime) < 2
        );
      return { clip, highlight, index };
    });
  }, [clips, highlights]);

  // Determine remaining in-progress highlights during cutting
  const pendingHighlights = React.useMemo(() => {
    if (!isCuttingClips) return [];
    const totalExpected =
      highlights.length > 0 ? highlights.length : Math.max(4, clips.length + 2);

    const pending: { highlight?: Highlight; index: number }[] = [];
    for (let i = clips.length; i < totalExpected; i++) {
      pending.push({
        highlight: highlights[i],
        index: i,
      });
    }
    return pending;
  }, [isCuttingClips, highlights, clips.length]);

  // Counts for impact filters
  const impactCounts = React.useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    pairedClips.forEach(({ highlight }) => {
      const score = highlight?.score ? highlight.score * 100 : 85;
      if (score >= 80) high++;
      else if (score >= 60) medium++;
      else low++;
    });

    return { all: pairedClips.length, high, medium, low };
  }, [pairedClips]);

  // Filter and sort finished clips
  const filteredAndSortedClips = React.useMemo(() => {
    return pairedClips
      .filter(({ clip, highlight, index }) => {
        const score = highlight?.score ? highlight.score * 100 : 85;
        if (impactFilter === "high" && score < 80) return false;
        if (impactFilter === "medium" && (score < 60 || score >= 80)) return false;
        if (impactFilter === "low" && score >= 60) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = (
            highlight?.clipTitle ||
            highlight?.hookText ||
            `Highlight #${index + 1}`
          ).toLowerCase();
          const reason = (highlight?.reason || "").toLowerCase();
          const style = (highlight?.style || "").toLowerCase();
          const tags = (highlight?.tags || []).join(" ").toLowerCase();

          return (
            title.includes(q) ||
            reason.includes(q) ||
            style.includes(q) ||
            tags.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score_desc") {
          const scoreA = a.highlight?.score ?? 0.85;
          const scoreB = b.highlight?.score ?? 0.85;
          return scoreB - scoreA;
        }
        if (sortBy === "duration_desc") {
          const durA = a.clip.endTime - a.clip.startTime;
          const durB = b.clip.endTime - b.clip.startTime;
          return durB - durA;
        }
        if (sortBy === "time_asc") {
          return a.clip.startTime - b.clip.startTime;
        }
        return 0;
      });
  }, [pairedClips, impactFilter, sortBy, searchQuery]);

  // If no clips generated yet and NOT in cutting/rendering mode, show empty state
  if (clips.length === 0 && !isCuttingClips && !isEarlyProcessing) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/60 p-12 text-center shadow-sm backdrop-blur-sm">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary mb-3">
          <FilmIcon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">
          No generated clips available
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          No clips were produced for this video. You can try reprocessing or check the original video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Filter & Search Toolbar (shown when clips exist or cutting) ── */}
      {(clips.length > 0 || isCuttingClips) && (
        <AppCard className="gap-4">
          {/* Left: Impact Filter Pills using AppTabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <AppTabs
              value={impactFilter}
              onValueChange={(val) => setImpactFilter(val as ImpactFilter)}
              tabs={[
                {
                  value: "all",
                  label: isCuttingClips
                    ? `All (${clips.length + pendingHighlights.length})`
                    : `All Clips (${impactCounts.all})`,
                },
                {
                  value: "high",
                  label: `High Impact (${impactCounts.high})`,
                  badge: (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block ml-1" />
                  ),
                },
                {
                  value: "medium",
                  label: `Medium (${impactCounts.medium})`,
                },
                {
                  value: "low",
                  label: `Low (${impactCounts.low})`,
                },
              ]}
              variant="default"
              size="default"
            />
          </div>

          {/* Right: Search & Sort controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search clips */}
            <div className="min-w-[180px] sm:min-w-[220px]">
              <AppInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clip titles, hooks..."
                size="default"
                prefixIcon={<SearchIcon className="h-3.5 w-3.5" />}
                className="bg-background/80"
              />
            </div>

            {/* Sort dropdown */}
            <div className="w-[140px]">
              <AppSelect
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
                size="default"
                placeholder="Sort by"
                className="bg-background/80"
                options={[
                  { value: "score_desc", label: "Score (High to Low)" },
                  { value: "duration_desc", label: "Duration (Longest)" },
                  { value: "time_asc", label: "Video Timeline" },
                ]}
              />
            </div>
          </div>
        </AppCard>
      )}

      {/* ── Clips Grid: Finished Clips + Real-time Skeleton Loaders ── */}
      {filteredAndSortedClips.length === 0 && !isCuttingClips ? (
        <div className="rounded-2xl border border-border/80 bg-card/60 p-10 text-center shadow-sm">
          <SparklesIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            No clips match your current filter
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or switching to &ldquo;All Clips&rdquo;.
          </p>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => {
              setImpactFilter("all");
              setSearchQuery("");
            }}
            className="mt-3 text-xs"
          >
            Reset Filters
          </AppButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* 1. Finished Clips */}
          {filteredAndSortedClips.map(({ clip, highlight, index }) => (
            <GeneratedClipCard
              key={clip._id || clip.id || index}
              job={job}
              clip={clip}
              highlight={highlight}
              clipIndex={index}
            />
          ))}

          {/* 2. In-Progress Skeleton Cards during cutting stage */}
          {isCuttingClips &&
            (impactFilter === "all" || searchQuery === "") &&
            pendingHighlights.map(({ highlight, index }) => (
              <ClipGeneratingSkeletonCard
                key={`pending-clip-${index}`}
                index={index}
                highlight={highlight}
              />
            ))}
        </div>
      )}
    </div>
  );
}

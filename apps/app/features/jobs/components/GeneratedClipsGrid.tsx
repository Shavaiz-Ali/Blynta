"use client";

import * as React from "react";
import { Highlight, Job, JobStatus } from "@/features/jobs";
import { GeneratedClipCard } from "./GeneratedClipCard";
import { AppTabs } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import {
  FilmIcon,
  SparklesIcon,
  SearchIcon,
  ClockIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@blynta/ui";
import { AppCard } from "@/components/common";
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
        "border border-border/70 bg-card/60 transition-colors",
        "p-0!",
      )}
      useDefaultClasses={false}
      contentClassName="!p-0 py-0!"
    >
      {/* ── Media Area: same 16:10 box as GeneratedClipCard's thumbnail ── */}
      <div className="relative aspect-[16/10] w-full bg-muted/30 flex flex-col items-center justify-between p-4 select-none overflow-hidden border-b border-border/60">
        {/* Top Badges */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/80 text-primary text-[10px] font-semibold border border-border/70 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span>Cutting Clip</span>
          </div>

          {score && (
            <span className="px-2 py-1 rounded-md bg-background/80 backdrop-blur-md text-foreground text-[10px] font-semibold border border-border/70">
              {score}% score
            </span>
          )}
        </div>

        {/* Center Live Processing Graphic (compact to fit the 16:10 box) */}
        <div className="flex flex-col items-center text-center space-y-2 my-auto z-10 px-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <FilmIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">
              Cutting &amp; Captioning
            </p>
            <p className="text-[10px] text-muted-foreground">
              Formatting video and captions
            </p>
          </div>
        </div>

        {/* Bottom Shimmer Bar */}
        <div className="w-full space-y-1.5 z-10">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3 text-primary" />
              <span>Rendering</span>
            </span>
            <span className="text-primary font-semibold">In Progress</span>
          </div>
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary/80 animate-pulse w-3/4 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Card Content: mirrors GeneratedClipCard body rows ── */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground">
              Clip {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {style}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
            {title}
          </h4>

          {/* Two shimmer lines standing in for the clip description (line-clamp-2) */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded bg-muted/70 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>

        {/* Bottom Controls Row */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Available when ready
          </span>
          <div className="h-7 w-7 rounded-md bg-muted/60 animate-pulse" />
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

  const clips = React.useMemo(() => job.clips ?? [], [job.clips]);
  const highlights = React.useMemo(
    () => job.highlights ?? [],
    [job.highlights],
  );
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
            Math.abs(h.endTime - clip.endTime) < 2,
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
      .filter(({ highlight, index }) => {
        const score = highlight?.score ? highlight.score * 100 : 85;
        if (impactFilter === "high" && score < 80) return false;
        if (impactFilter === "medium" && (score < 60 || score >= 80))
          return false;
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
          No clips were produced for this video. You can try reprocessing or
          check the original video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Filter & Search Toolbar (shown when clips exist or cutting) ── */}
      {(clips.length > 0 || isCuttingClips) && (
        <div className="flex flex-col gap-3 border-y border-border/60 py-4 lg:flex-row lg:items-center lg:justify-between">
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
            <div className="min-w-[200px] sm:min-w-[240px]">
              <AppInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clip titles, hooks..."
                size="sm"
                prefixIcon={<SearchIcon className="h-3.5 w-3.5" />}
                className="bg-background/80"
              />
            </div>

            {/* Sort dropdown */}
            <div className="w-[160px]">
              <AppSelect
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
                size="sm"
                placeholder="Sort by"
                className="bg-background/80"
                options={[
                  { value: "score_desc", label: "Highest score" },
                  { value: "duration_desc", label: "Duration (Longest)" },
                  { value: "time_asc", label: "Video Timeline" },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Clips Grid: Finished Clips + Real-time Skeleton Loaders ── */}
      {filteredAndSortedClips.length === 0 && !isCuttingClips ? (
        <div className="rounded-2xl border border-border/80 bg-card/60 p-10 text-center shadow-sm">
          <SparklesIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            No clips match your current filter
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or switching to &ldquo;All
            Clips&rdquo;.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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

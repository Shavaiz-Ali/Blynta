"use client";

import * as React from "react";
import { Clip, Highlight, Job } from "@/features/jobs";
import { GeneratedClipCard } from "./GeneratedClipCard";
import { AppTabs } from "@/components/common/AppTabs";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect } from "@/components/common/AppSelect";
import {
  FilmIcon,
  SparklesIcon,
  SearchIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common";

export interface GeneratedClipsGridProps {
  job: Job;
}

type ImpactFilter = "all" | "high" | "medium" | "low";
type SortOption = "score_desc" | "duration_desc" | "time_asc";

export function GeneratedClipsGrid({ job }: GeneratedClipsGridProps) {
  const [impactFilter, setImpactFilter] = React.useState<ImpactFilter>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("score_desc");
  const [searchQuery, setSearchQuery] = React.useState("");

  const clips = job.clips ?? [];
  const highlights = job.highlights ?? [];

  // Pair each clip with its corresponding highlight
  const pairedClips = React.useMemo(() => {
    return clips.map((clip, index) => {
      // Find matching highlight by index or timestamp proximity
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

  // Filter and sort clips
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

  if (clips.length === 0) {
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
      {/* ── Filter & Search Toolbar ── */}
      <AppCard className="gap-4">
        {/* Left: Impact Filter Pills using AppTabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <AppTabs
            value={impactFilter}
            onValueChange={(val) => setImpactFilter(val as ImpactFilter)}
            tabs={[
              {
                value: "all",
                label: `All Clips (${impactCounts.all})`,
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

      {/* ── Clips Grid ── */}
      {filteredAndSortedClips.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSortedClips.map(({ clip, highlight, index }) => (
            <GeneratedClipCard
              key={clip._id || clip.id || index}
              job={job}
              clip={clip}
              highlight={highlight}
              clipIndex={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

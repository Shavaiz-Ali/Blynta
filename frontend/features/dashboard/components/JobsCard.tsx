"use client";

import * as React from "react";
import Link from "next/link";
import { JobsSkeleton } from "./JobsSkeleton";
import { Job, JobStatus } from "@/features/jobs";
import { ViewModeToggle, ViewMode } from "./ViewModeToggle";
import { JobCardGrid } from "./JobCardGrid";
import { JobCardList } from "./JobCardList";
import {
  FilmIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
} from "../icons";

function EmptyStateTips() {
  const tips = [
    {
      icon: <YoutubeIcon className="h-4 w-4 text-[#FF0000]" />,
      title: "Long-form YouTube videos work best",
      desc: "Podcasts and talking-head clips yield the most engaging highlights.",
    },
    {
      icon: <CheckCircleIcon className="h-4 w-4" />,
      title: "Each job uses 1 credit",
      desc: "Free accounts get 5 credits/month. Upgrade for more + HD exports.",
    },
    {
      icon: <LightbulbIcon className="h-4 w-4" />,
      title: "Avoid heavy background music",
      desc: "Clean audio gives the AI sharper transcription and better clips.",
    },
  ];

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8 text-left w-full max-w-2xl">
      {tips.map((t, i) => (
        <li
          key={i}
          className="flex flex-col p-3.5 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-border transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2.5">
            {t.icon}
          </div>
          <p className="text-xs font-semibold text-foreground">{t.title}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {t.desc}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function JobsCard({ jobs, isLoading = false }: { jobs: Job[]; isLoading?: boolean }) {

  // Persistent view mode state
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("blynta_dashboard_view_mode_v2", mode);
  };

  const activeCount = jobs.filter(
    (j) =>
      j.status === JobStatus.PENDING ||
      j.status === JobStatus.TRANSCRIBING ||
      j.status === JobStatus.DETECTING_HIGHLIGHTS ||
      j.status === JobStatus.CUTTING_CLIPS
  ).length;

  if (isLoading) return <JobsSkeleton viewMode={viewMode} />;

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card/30 p-4 shadow-xs sm:p-5">
      {/* ── Unified Section Header & Controls ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Recent projects</h3>
            {activeCount > 0 ? (
              <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {activeCount} active
              </span>
            ) : (
              <span className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">{jobs.length} total</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Continue reviewing your latest videos and generated clips.</p>
        </div>

        {jobs.length > 0 && (
          <div className="flex items-center gap-3">
            {/* Grid vs List View Toggle */}
            <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />

            {/* View all Link */}
            <Link
              href="/my-clips"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors pl-1"
            >
              <span>View all</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── Main Content Area: Empty State vs Grid / List ── */}
      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-8 sm:p-12 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary border border-primary/20 shadow-2xs">
            <FilmIcon className="h-7 w-7" />
          </div>
          <h4 className="text-base font-bold text-foreground">No projects yet</h4>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md">
            Paste a video link above and Blynta will analyze conversational salience, cut
            vertical clips, and generate dynamic subtitles automatically.
          </p>
          <EmptyStateTips />
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {jobs.slice(0, 9).map((job) => (
            <JobCardGrid key={job._id || job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {jobs.slice(0, 9).map((job) => (
            <JobCardList key={job._id || job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}

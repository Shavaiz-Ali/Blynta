"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Job,
  JobStatus,
  useJobs,
} from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { JobsSkeleton } from "@/features/dashboard/components/JobsSkeleton";
import { ViewModeToggle, ViewMode } from "@/features/dashboard/components/ViewModeToggle";
import { JobCardGrid } from "@/features/dashboard/components/JobCardGrid";
import { JobCardList } from "@/features/dashboard/components/JobCardList";
import { cn } from "@/lib/utils";
import {
  FilmIcon,
  AlertTriangleIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/features/dashboard/icons";

/* -------------------------------------------------------------------------- */
/*  Filter config                                                              */
/* -------------------------------------------------------------------------- */

type FilterValue = "all" | "processing" | JobStatus.COMPLETED | JobStatus.FAILED;

const ACTIVE_STATUSES: JobStatus[] = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: JobStatus.COMPLETED },
  { label: "Failed", value: JobStatus.FAILED },
];

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
    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left w-full max-w-2xl">
      {tips.map((t, i) => (
        <li
          key={i}
          className="flex flex-col p-3.5 rounded-xl bg-card border border-border/60 shadow-2xs"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
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

/* -------------------------------------------------------------------------- */
/*  MyClipsClient — full page component wrapped in DashboardLayout           */
/* -------------------------------------------------------------------------- */

export function MyClipsClient() {
  const router = useRouter();
  const { data: profile } = useCurrentUser();
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [page, setPage] = React.useState(1);
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const LIMIT = 24;

  // Load saved view mode
  React.useEffect(() => {
    const saved = localStorage.getItem("blynta_clips_view_mode") as ViewMode;
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("blynta_clips_view_mode", mode);
  };

  const apiStatus =
    filter === "all" || filter === "processing"
      ? undefined
      : (filter as JobStatus);

  const { data, isLoading, error } = useJobs({
    status: apiStatus,
    page,
    limit: LIMIT,
  });

  const allJobs = data?.jobs ?? [];
  const jobs =
    filter === "processing"
      ? allJobs.filter((j) => ACTIVE_STATUSES.includes(j.status))
      : allJobs;

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setPage(1);
  }, [filter]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      <h1 className="text-sm font-medium text-foreground">My Clips</h1>

      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6 max-w-7xl mx-auto">
        {/* ── Header row with page title, Filter tabs & View toggle ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Media Archives & Clips<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Browse your processed long-form videos and viral shorts.
            </p>
          </div>

          {/* Right controls: Filter tabs + View Mode toggle */}
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {/* Filter Pills Tabs */}
            <div className="flex items-center gap-1 p-1 bg-card/90 rounded-lg border border-border/80 shadow-2xs backdrop-blur-sm">
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                      active
                        ? "bg-background text-foreground font-semibold border border-border/80 shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle (Grid vs. List) */}
            <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
          </div>
        </div>

        {/* ── Content area ── */}
        {isLoading ? (
          <JobsSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm text-center">
            <AlertTriangleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load your clips
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as any)?.message || "Please refresh the page to try again."}
            </p>
          </div>
        ) : filter === "all" && total === 0 ? (
          /* Zero jobs TOTAL (no filter) — onboarding empty state */
          <div className="rounded-2xl border border-border/80 bg-card/60 shadow-sm overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-12 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary border border-primary/20">
                <FilmIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No media archives yet</h3>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm">
                Paste a video link on the{" "}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-primary underline hover:text-primary/80 transition-colors cursor-pointer"
                >
                  dashboard
                </button>{" "}
                to generate viral vertical clips automatically.
              </p>
              <EmptyStateTips />
            </div>
          </div>
        ) : jobs.length === 0 ? (
          /* Jobs filtered to zero (but jobs DO exist) — simple empty state */
          <div className="rounded-2xl border border-border/80 bg-card/60 shadow-sm overflow-hidden backdrop-blur-sm">
            <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
              <FilmIcon className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                No{" "}
                {FILTER_OPTIONS.find((f) => f.value === filter)?.label.toLowerCase()}{" "}
                videos found
              </p>
              <p className="text-xs text-muted-foreground">
                Try switching to a different filter or check your search terms.
              </p>
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
                className="mt-1"
              >
                Show all archives
              </AppButton>
            </div>
          </div>
        ) : (
          /* Has jobs */
          <div className="space-y-6">
            {/* Grid or List Display */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {jobs.map((job) => (
                  <JobCardGrid
                    key={job._id || job.id}
                    job={job}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {jobs.map((job) => (
                  <JobCardList
                    key={job._id || job.id}
                    job={job}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <AppButton
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    icon={<ChevronLeftIcon className="h-4 w-4" />}
                    className="h-8 px-3"
                  >
                    Prev
                  </AppButton>
                  <AppButton
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    icon={<ChevronRightIcon className="h-4 w-4" />}
                    iconPosition="right"
                    className="h-8 px-3"
                  >
                    Next
                  </AppButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

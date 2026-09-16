"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Job, JobStatus, useJobs } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppTabs } from "@/components/common/AppTabs";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect } from "@/components/common/AppSelect";
import { AppCard } from "@/components/common/AppCard";
import { ViewModeToggle, ViewMode } from "@/features/dashboard/components/ViewModeToggle";
import { SourceVideoCard } from "./SourceVideoCard";
import { ClipsLibrarySkeleton } from "./ClipsLibrarySkeleton";
import {
  FilmIcon,
  SearchIcon,
  PlusIcon,
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
} from "@/features/dashboard/icons";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "processing" | JobStatus.COMPLETED | JobStatus.FAILED;
type SortOption = "newest" | "oldest" | "clips_desc" | "duration_desc";

const ACTIVE_STATUSES: JobStatus[] = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

function EmptyStateTips() {
  const tips = [
    {
      icon: <YoutubeIcon className="h-4 w-4 text-[#FF0000]" />,
      title: "Long-form YouTube videos work best",
      desc: "Podcasts, interviews, and talking-head videos produce the highest engagement.",
    },
    {
      icon: <CheckCircleIcon className="h-4 w-4" />,
      title: "Automated AI clipping",
      desc: "Blynta scores virality, trims pauses, and burns styled dynamic subtitles.",
    },
    {
      icon: <LightbulbIcon className="h-4 w-4" />,
      title: "Clean audio = sharper clips",
      desc: "Minimizing heavy background tracks yields precise speech transcription.",
    },
  ];
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8 text-left w-full max-w-2xl">
      {tips.map((t, i) => (
        <li
          key={i}
          className="flex flex-col p-3.5 rounded-xl bg-card border border-border/70 shadow-2xs"
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

export function ClipsLibrary() {
  const router = useRouter();
  const { data: profile } = useCurrentUser();

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
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
    statusFilter === "all" || statusFilter === "processing"
      ? undefined
      : (statusFilter as JobStatus);

  const { data, isLoading, error } = useJobs({
    status: apiStatus,
    page,
    limit: LIMIT,
  });

  const allJobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Filter jobs by processing status (if processing filter active) and by search query
  const filteredJobs = React.useMemo(() => {
    let result = allJobs;

    if (statusFilter === "processing") {
      result = result.filter((j) => ACTIVE_STATUSES.includes(j.status));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((j) => {
        const title = (j.videoTitle || "").toLowerCase();
        const uploader = (j.videoUploader || "").toLowerCase();
        const url = (j.sourceUrl || "").toLowerCase();
        const platform = (j.sourcePlatform || "").toLowerCase();
        return (
          title.includes(q) ||
          uploader.includes(q) ||
          url.includes(q) ||
          platform.includes(q)
        );
      });
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortBy === "clips_desc") {
        return (b.clips?.length ?? 0) - (a.clips?.length ?? 0);
      }
      if (sortBy === "duration_desc") {
        return (b.videoDuration ?? 0) - (a.videoDuration ?? 0);
      }
      return 0;
    });
  }, [allJobs, statusFilter, searchQuery, sortBy]);

  // Reset to page 1 on filter change
  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-foreground">Clips</h1>
        <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
          {total} videos
        </span>
      </div>

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
      {/* ── Page Header Lockup ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Clips Library<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Turn your long-form videos into high-performing viral shorts.
          </p>
        </div>

        {/* Primary Action Button */}
        <AppButton
          variant="default"
          size="sm"
          onClick={() => router.push("/dashboard")}
          icon={<PlusIcon className="h-4 w-4" />}
          className="self-start md:self-auto h-9 font-semibold shadow-sm"
        >
          Create New Clips
        </AppButton>
      </div>

      {/* ── Filter, Search & View Controls Toolbar ── */}
      <AppCard className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 " useDefaultClasses={true}>
        {/* Left: Status Filter Tabs using AppTabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <AppTabs
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as StatusFilter)}
            tabs={[
              { value: "all", label: "All Videos" },
              { value: "processing", label: "Processing" },
              { value: JobStatus.COMPLETED, label: "Completed" },
              { value: JobStatus.FAILED, label: "Failed" },
            ]}
            variant="default"
            size="default"
          />
        </div>

        {/* Right: Search, Sort & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="min-w-[200px] sm:min-w-[240px]">
            <AppInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, creator, URL..."
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
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "clips_desc", label: "Most Clips" },
                { value: "duration_desc", label: "Duration" },
              ]}
            />
          </div>

          {/* Grid vs List View Toggle */}
          <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
        </div>
      </AppCard>

      {/* ── Content Area ── */}
      {isLoading ? (
        <ClipsLibrarySkeleton viewMode={viewMode} />
      ) : error ? (
        <AppCard className="p-8 text-center border-destructive/30" useDefaultClasses={false}>
          <AlertTriangleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            We couldn&apos;t load your videos
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error.message || "Please refresh the page to try again."}
          </p>
          <AppButton
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.refresh()}
          >
            Try again
          </AppButton>
        </AppCard>
      ) : statusFilter === "all" && total === 0 ? (
        /* Zero videos onboarding empty state */
        <AppCard className=" overflow-hidden" useDefaultClasses={false}>
          <div className="px-6 py-14 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-md bg-primary/10 flex items-center justify-center mb-4 text-primary border border-primary/20">
              <FilmIcon className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No videos yet</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md">
              Upload or paste a long-form video link to start automatically extracting high-performing viral shorts.
            </p>
            <AppButton
              variant="default"
              size="default"
              onClick={() => router.push("/dashboard")}
              icon={<PlusIcon className="h-4 w-4" />}
              className="mt-5 font-semibold shadow-sm"
            >
              Create your first video
            </AppButton>
            <EmptyStateTips />
          </div>
        </AppCard>
      ) : filteredJobs.length === 0 ? (
        /* Filtered to zero */
        <AppCard className="p-0 overflow-hidden" useDefaultClasses={false}>
          <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
            <FilmIcon className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">
              No videos match your criteria
            </p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search query or reset your status filter.
            </p>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="mt-1"
            >
              Show all videos
            </AppButton>
          </div>
        </AppCard>
      ) : (
        /* Render Videos */
        <div className="space-y-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredJobs.map((job) => (
                <SourceVideoCard
                  key={job._id || job.id}
                  job={job}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredJobs.map((job) => (
                <SourceVideoCard
                  key={job._id || job.id}
                  job={job}
                  viewMode="list"
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
    </DashboardLayout>
  );
}

"use client";

import * as React from "react";
import { useViewMode } from "@/features/dashboard/use-view-mode";
import { useRouter } from "next/navigation";
import { JobStatus, useJobs } from "@/features/jobs";
import { PageContent } from "@/components/layout/PageContent";

import { AppButton } from "@blynta/ui";
import { AppCard } from "@blynta/ui";
import {
  LibraryCount,
  LibraryHeading,
  LibraryToolbar,
  LibraryItems,
  LibraryPagination,
} from "./ClipLibraryLayout";
import { SourceVideoCard } from "./SourceVideoCard";
import { ClipsLibrarySkeleton } from "./ClipsLibrarySkeleton";
import {
  FilmIcon,
  PlusIcon,
  AlertTriangleIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
} from "@/features/dashboard/icons";

type StatusFilter =
  "all" | "processing" | JobStatus.COMPLETED | JobStatus.FAILED;
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

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [page, setPage] = React.useState(1);
  const [viewMode, handleViewModeChange] = useViewMode(
    "blynta_clips_view_mode",
  );
  const LIMIT = 24;

  const apiStatus =
    statusFilter === "all" || statusFilter === "processing"
      ? undefined
      : (statusFilter as JobStatus);

  const { data, isLoading, error, refetch, isFetching } = useJobs({
    status: apiStatus,
    page,
    limit: LIMIT,
  });

  const allJobs = React.useMemo(() => data?.jobs ?? [], [data?.jobs]);
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

  const contextualToolbar = <LibraryCount count={total} label="videos" />;

  return (
    <PageContent toolbar={contextualToolbar}>
      <LibraryHeading
        title={
          <>
            Clips Library<span className="text-primary">.</span>
          </>
        }
        description="Turn your long-form videos into high-performing viral shorts."
        action={
          <AppButton
            variant="default"
            size="sm"
            onClick={() => router.push("/dashboard")}
            icon={<PlusIcon className="h-4 w-4" />}
            className="self-start md:self-auto h-9 font-semibold shadow-sm"
          >
            Create New Clips
          </AppButton>
        }
      />
      <LibraryToolbar
        filter={statusFilter}
        onFilterChange={(val) => {
          setStatusFilter(val as StatusFilter);
          setPage(1);
        }}
        filters={[
          { value: "all", label: "All Videos" },
          { value: "processing", label: "Processing" },
          { value: JobStatus.COMPLETED, label: "Completed" },
          { value: JobStatus.FAILED, label: "Failed" },
        ]}
        search={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search by title, creator, URL..."
        sort={sortBy}
        onSortChange={(value) => setSortBy(value as SortOption)}
        sortOptions={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
          { value: "clips_desc", label: "Most Clips" },
          { value: "duration_desc", label: "Duration" },
        ]}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />
      {/* ── Content Area ── */}
      {viewMode === null || (isLoading && !data) ? (
        <ClipsLibrarySkeleton viewMode={viewMode} showHeader={false} />
      ) : error && !data ? (
        <AppCard
          className="p-8 text-center border-destructive/30"
          useDefaultClasses={false}
        >
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
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? "Retrying..." : "Try again"}
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
              Upload or paste a long-form video link to start automatically
              extracting high-performing viral shorts.
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
                setPage(1);
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
          <LibraryItems viewMode={viewMode}>
            {filteredJobs.map((job) => (
              <SourceVideoCard
                key={job._id || job.id}
                job={job}
                viewMode={viewMode}
              />
            ))}
          </LibraryItems>
          <LibraryPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </PageContent>
  );
}

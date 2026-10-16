"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppButton, AppCard, AppQueryState, AppSpinner } from "@blynta/ui";
import { PageContent } from "@/components/layout/PageContent";
import { useViewMode } from "@/features/dashboard/use-view-mode";
import {
  LibraryCount,
  LibraryHeading,
  LibraryToolbar,
  LibraryItems,
  LibraryPagination,
} from "@/features/jobs/components/ClipLibraryLayout";
import { useStudioClips } from "./queries";
import { StudioClipCard } from "./StudioClipCard";
export function StudioLanding() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useViewMode("blynta_studio_view_mode");
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const clips = useStudioClips(query, sort, page, true, filter);
  const changing = clips.isPlaceholderData || search.trim() !== query;
  return (
    <PageContent
      toolbar={<LibraryCount count={clips.data?.total} label="clips" />}
    >
      <LibraryHeading
        title="AI Studio"
        description="Edit your clips using AI."
      />
      <LibraryToolbar
        filter={filter}
        onFilterChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        filters={[
          { value: "all", label: "All Clips" },
          { value: "edited", label: "Edited" },
        ]}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search clips..."
        maxSearchLength={100}
        sort={sort}
        onSortChange={(value) => {
          setSort(value);
          setPage(1);
        }}
        sortOptions={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
        ]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {viewMode === null || (clips.isPending && !clips.data) ? (
        <div
          role="status"
          className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <AppSpinner size="xs" />
          Loading clips…
        </div>
      ) : clips.isError && !clips.data ? (
        <AppQueryState
          title="Clips couldn’t be loaded"
          description="Retry to browse your clips."
          retrying={clips.isFetching}
          onRetry={() => void clips.refetch()}
        />
      ) : !clips.data?.items.length ? (
        <AppCard
          useDefaultClasses={false}
          contentClassName="flex flex-col items-center px-6 py-14 text-center"
        >
          <h2 className="text-lg font-bold">
            {query
              ? "No clips match your search"
              : filter === "edited"
                ? "No edited clips yet"
                : "No clips ready to edit"}
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            {query
              ? "Try another title or clear your search."
              : filter === "edited"
                ? "Choose a clip from All Clips to start editing."
                : "Create clips from a video to edit them with AI."}
          </p>
          {query ? (
            <AppButton
              className="mt-5"
              variant="outline"
              onClick={() => {
                setSearch("");
                setQuery("");
                setPage(1);
              }}
            >
              Clear search
            </AppButton>
          ) : filter === "edited" ? (
            <AppButton
              className="mt-5"
              variant="outline"
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
            >
              Show all clips
            </AppButton>
          ) : (
            <AppButton
              className="mt-5"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              Create New Clips
            </AppButton>
          )}
        </AppCard>
      ) : (
        <div className="space-y-6">
          <LibraryItems
            viewMode={viewMode}
            busy={clips.isFetching}
            disabled={changing}
          >
            {clips.data.items.map((clip) => (
              <StudioClipCard key={clip._id} clip={clip} viewMode={viewMode} />
            ))}
          </LibraryItems>
          <LibraryPagination
            page={page}
            totalPages={clips.data.totalPages}
            disabled={clips.isFetching || changing}
            onPageChange={setPage}
          />
        </div>
      )}
      {clips.isFetching && clips.data && (
        <p role="status" className="text-xs text-muted-foreground">
          Updating clips…
        </p>
      )}
      {clips.isError && clips.data && (
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn’t refresh your clips.{" "}
          <AppButton
            variant="link"
            size="sm"
            onClick={() => void clips.refetch()}
          >
            Try again
          </AppButton>
        </p>
      )}
    </PageContent>
  );
}

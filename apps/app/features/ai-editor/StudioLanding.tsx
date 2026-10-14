"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Clapperboard } from "lucide-react";
import {
  AppButton,
  AppInput,
  AppSelect,
  AppPagination,
  AppQueryState,
} from "@blynta/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContent } from "@/components/layout/PageContent";
import { useJobs, JobStatus } from "@/features/jobs";
import { useRecentPlans } from "./queries";
import { StudioClipCard } from "./StudioClipCard";
export function StudioLanding() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("newest"),
    [filter, setFilter] = useState("all");
  const jobs = useJobs({ status: JobStatus.COMPLETED, page, limit: 12 });
  const recent = useRecentPlans();
  const edited = new Set(recent.data?.items.map((p) => p.sourceClipId));
  const allClips =
    jobs.data?.jobs.flatMap((job) =>
      job.clips
        .filter(
          (c) => c.status === JobStatus.COMPLETED && !job.deletionRequested,
        )
        .map((clip, index) => ({
          job,
          clip,
          title:
            job.highlights?.find(
              (h) =>
                h.startTime === clip.startTime && h.endTime === clip.endTime,
            )?.clipTitle || `Clip ${index + 1}`,
        })),
    ) ?? [];
  const clips = allClips.filter(
    (c) =>
      c.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter === "all" || edited.has(String(c.clip._id || c.clip.id))),
  );
  clips.sort((a, b) => {
    const order =
      new Date(a.clip.createdAt || a.job.createdAt).getTime() -
      new Date(b.clip.createdAt || b.job.createdAt).getTime();
    return sort === "oldest" ? order : -order;
  });
  return (
    <PageContent>
      <div className="mx-auto w-full max-w-7xl space-y-7 pb-12">
        <header className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Studio</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn your clips into something better. Make your next edit with a
              prompt.
            </p>
          </div>
        </header>
        {recent.isError ? (
          <AppQueryState
            title="Recent edits couldn’t be loaded"
            description="You can still start from a clip below."
            onRetry={() => void recent.refetch()}
          />
        ) : recent.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          !!recent.data?.items.length && (
            <section aria-labelledby="recent-edits">
              <h2 id="recent-edits" className="mb-3 text-base font-semibold">
                Continue editing
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recent.data.items.slice(0, 8).map((plan) => (
                  <StudioClipCard
                    key={plan._id}
                    href={`/studio/${plan.sourceClipId}?jobId=${plan.sourceJobId}`}
                    title={plan.clipTitle || "Edited clip"}
                    thumbnail={plan.thumbnailUrl}
                    duration={plan.outputDuration}
                    subtitle={`Edited ${new Date(plan.updatedAt).toLocaleDateString()} · ${plan.latestPreview ? "Preview " + plan.latestPreview.status + " · r" + plan.latestPreview.revision : "No preview yet"}`}
                    action="Continue editing"
                  />
                ))}
              </div>
            </section>
          )
        )}
        <section aria-labelledby="editable-clips">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="editable-clips" className="text-base font-semibold">
              Start a new edit
            </h2>
            <AppButton
              variant="link"
              size="sm"
              nativeButton={false}
              role="link"
              render={<Link href="/my-clips" />}
            >
              All clips
            </AppButton>
          </div>
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1 basis-56">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <AppInput
                  aria-label="Search clip titles on this page"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clip titles on this page…"
                  className="pl-9"
                />
              </div>
              <AppSelect
                aria-label="Sort clips on this page"
                value={sort}
                onValueChange={setSort}
                wrapperClassName="w-44"
                options={[
                  { value: "newest", label: "Newest on page" },
                  { value: "oldest", label: "Oldest on page" },
                ]}
              />
              <AppSelect
                aria-label="Editing status on this page"
                value={filter}
                onValueChange={setFilter}
                disabled={recent.isPending || recent.isError}
                wrapperClassName="w-44"
                options={[
                  { value: "all", label: "All clips" },
                  { value: "recent", label: "Recent edits" },
                ]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Search and sort cover this page of 12 videos. Recent edits matches
              your last 25 editing plans.
            </p>
          </div>
          {jobs.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-60 rounded-lg" />
              ))}
            </div>
          ) : jobs.isError ? (
            <AppQueryState
              title="Clips couldn’t be loaded"
              description="Retry to browse your completed clips."
              onRetry={() => void jobs.refetch()}
              retrying={jobs.isFetching}
            />
          ) : !clips.length ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center">
              <Clapperboard className="mx-auto mb-3 size-7 text-muted-foreground" />
              <h3 className="font-medium">
                {allClips.length
                  ? "No matching clips on this page"
                  : "No completed clips on this page"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allClips.length
                  ? "Clear your filters or browse another page."
                  : "Generate shorts from a video to start your first edit."}
              </p>
              <AppButton
                className="mt-4"
                variant="outline"
                size="sm"
                {...(allClips.length
                  ? {
                      onClick: () => {
                        setSearch("");
                        setFilter("all");
                      },
                    }
                  : { render: <Link href="/dashboard" /> })}
              >
                {allClips.length ? "Clear filters" : "Create clips"}
              </AppButton>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {clips.map(({ job, clip, title }) => (
                <StudioClipCard
                  key={`${job._id}-${clip._id}`}
                  href={`/studio/${clip._id}?jobId=${job._id}`}
                  title={title}
                  thumbnail={job.thumbnailUrl}
                  duration={clip.endTime - clip.startTime}
                  action="Edit with AI"
                />
              ))}
            </div>
          )}
          <div className="mt-5 border-t pt-4">
            <AppPagination
              page={page}
              totalPages={jobs.data?.totalPages}
              onPageChange={(p) => {
                setPage(p);
                setSearch("");
              }}
              disabled={jobs.isFetching}
            />
          </div>
        </section>
      </div>
    </PageContent>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  AppButton,
  AppInput,
  AppSelect,
  AppPagination,
  AppQueryState,
} from "@blynta/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContent } from "@/components/layout/PageContent";
import { useRecentPlans, useStudioClips } from "./queries";
import { StudioClipCard } from "./StudioClipCard";
export function StudioLanding() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const clips = useStudioClips(query, sort, page);
  const recent = useRecentPlans();
  return (
    <PageContent>
      <div className="mx-auto w-full max-w-7xl space-y-9 pb-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">AI Studio</h1>
          <p className="text-sm text-muted-foreground">
            Turn your clips into something better. Make your next edit with a
            prompt.
          </p>
        </header>
        <section aria-labelledby="recent-edits" className="space-y-4">
          <h2 id="recent-edits" className="text-sm font-semibold">
            Continue editing
          </h2>
          {recent.isPending ? (
            <ClipSkeletons count={3} />
          ) : recent.isError ? (
            <AppQueryState
              title="Recent edits couldn’t be loaded"
              description="Your clips are still available below."
              onRetry={() => void recent.refetch()}
            />
          ) : recent.data?.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {recent.data.items.slice(0, 4).map((plan) => (
                <StudioClipCard
                  key={plan._id}
                  href={`/studio/${plan.sourceClipId}?jobId=${plan.sourceJobId}`}
                  title={plan.clipTitle || plan.sourceTitle || "Edited clip"}
                  thumbnail={plan.thumbnailUrl}
                  duration={plan.outputDuration}
                  subtitle={`Edited ${new Date(plan.updatedAt).toLocaleDateString()} · ${plan.latestPreview?.status === "completed" ? (plan.latestPreview.revision === plan.revision ? "Preview ready" : "Preview outdated") : plan.latestPreview?.status === "processing" || plan.latestPreview?.status === "queued" ? "Rendering preview" : "Saved edits"}`}
                  action="Continue editing"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your editing projects will appear here. Choose a clip below to
              begin.
            </p>
          )}
        </section>
        <section aria-labelledby="your-clips" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="your-clips" className="text-sm font-semibold">
              Your clips
            </h2>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-64">
                <Search
                  aria-hidden
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                />
                <AppInput
                  aria-label="Search your clips"
                  placeholder="Search clips…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <AppSelect
                aria-label="Sort clips"
                value={sort}
                onValueChange={(v) => {
                  setSort(v);
                  setPage(1);
                }}
                wrapperClassName="w-32 shrink-0"
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
              />
            </div>
          </div>
          {clips.isPending ? (
            <ClipSkeletons count={8} />
          ) : clips.isError ? (
            <AppQueryState
              title="Clips couldn’t be loaded"
              description="Retry to browse your completed clips."
              onRetry={() => void clips.refetch()}
            />
          ) : !clips.data?.items.length ? (
            <div className="py-14 text-center">
              <h3 className="font-medium">
                {query
                  ? "No matching clips"
                  : "Your first edit starts with a clip"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {query
                  ? "Try another title or clear your search."
                  : "Create clips from a video, then bring them here."}
              </p>
              {query ? (
                <AppButton
                  variant="ghost"
                  className="mt-4"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </AppButton>
              ) : (
                <AppButton
                  variant="outline"
                  className="mt-4"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  Create clips
                </AppButton>
              )}
            </div>
          ) : (
            <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {clips.data.items.map((clip) => (
                <StudioClipCard
                  key={clip._id}
                  href={`/studio/${clip._id}?jobId=${clip.jobId}`}
                  title={clip.title}
                  thumbnail={clip.thumbnailUrl}
                  duration={clip.duration}
                  subtitle={new Date(clip.createdAt).toLocaleDateString()}
                  action="Edit with AI"
                />
              ))}
            </div>
          )}
          <AppPagination
            page={page}
            totalPages={clips.data?.totalPages}
            onPageChange={setPage}
            disabled={clips.isFetching}
          />
        </section>
      </div>
    </PageContent>
  );
}
function ClipSkeletons({ count }: { count: number }) {
  return (
    <div
      role="status"
      aria-label="Loading clips"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

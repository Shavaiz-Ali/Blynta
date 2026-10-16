"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  AppButton,
  AppDialog,
  AppInput,
  AppPagination,
  AppQueryState,
} from "@blynta/ui";
import { useStudioClips } from "./queries";
import { StudioListingSkeleton } from "./StudioListingSkeleton";
import { editTime } from "./presentation";

export function StudioClipPicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const clips = useStudioClips(query, "newest", page, open);
  const changing = clips.isPlaceholderData || search.trim() !== query;
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New AI Edit"
      description="Choose a clip to edit. Existing projects open where you left off."
      size="lg"
      contentClassName="max-h-[85dvh]"
      bodyClassName="min-h-0 overflow-y-auto"
    >
      <div className="space-y-4">
        <AppInput
          autoFocus
          aria-label="Search clips to edit"
          placeholder="Search clips…"
          prefixIcon={<Search className="size-3.5" />}
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        {clips.isPending ? (
          <StudioListingSkeleton viewMode="list" count={3} />
        ) : clips.isError && !clips.data ? (
          <AppQueryState
            title="Clips couldn’t be loaded"
            description="Retry to browse your eligible clips."
            onRetry={() => void clips.refetch()}
          />
        ) : !clips.data?.items.length ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold">
              {query ? "No matching clips" : "No clips ready to edit"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {query
                ? "Try another title."
                : "Create clips from a video to start an AI edit."}
            </p>
            {query ? (
              <AppButton
                variant="ghost"
                className="mt-3"
                onClick={() => setSearch("")}
              >
                Clear search
              </AppButton>
            ) : (
              <AppButton
                className="mt-3"
                onClick={() => router.push("/dashboard")}
              >
                Create New Clips
              </AppButton>
            )}
          </div>
        ) : (
          <div
            aria-busy={clips.isFetching}
            className={`space-y-2 ${changing ? "opacity-60" : ""}`}
          >
            {clips.data.items.map((clip) => (
              <AppButton
                key={clip._id}
                variant="outline"
                disabled={changing}
                className="h-auto w-full justify-start p-3 text-left"
                contentClassName="w-full justify-between gap-3"
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/studio/${clip._id}?jobId=${clip.jobId}`);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {clip.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {editTime(clip.duration)} ·{" "}
                    {clip.projectId ? "Open project" : "Edit with AI"}
                  </span>
                </span>
              </AppButton>
            ))}
          </div>
        )}
        {(clips.data?.totalPages ?? 0) > 1 && (
          <AppPagination
            page={page}
            totalPages={clips.data?.totalPages}
            disabled={clips.isFetching || changing}
            onPageChange={setPage}
          />
        )}
      </div>
    </AppDialog>
  );
}

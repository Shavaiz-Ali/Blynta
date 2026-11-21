import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "./ViewModeToggle";

export function JobsSkeleton({
  viewMode = "grid",
  showHeader = true,
}: {
  viewMode?: ViewMode | null;
  showHeader?: boolean;
}) {
  if (viewMode === null) {
    return (
      <div
        role="status"
        aria-label="Loading view preference"
        className="flex min-h-48 items-center justify-center rounded-xl border border-border/70 bg-card/30 text-sm text-muted-foreground"
      >
        Loading your library…
      </div>
    );
  }
  return (
    <div className="space-y-4" role="status" aria-label="Loading projects">
      {showHeader && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-1"
          aria-hidden="true"
        >
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
      )}
      <div
        aria-hidden="true"
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            : "space-y-2.5"
        }
      >
        {Array.from({ length: 6 }, (_, i) =>
          viewMode === "grid" ? (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
            >
              {/* matches AppCard with contentClassName="flex-col gap-4 sm:flex-row sm:items-center" and p-3 */}
              <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                {/* thumbnail: matches h-16 w-28 sm:h-20 sm:w-36 rounded-md */}
                <Skeleton className="h-16 w-28 shrink-0 rounded-md sm:h-20 sm:w-36" />
                {/* text block: flex-1 min-w-0 space-y-1 */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                  {/* status badge placeholder */}
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                {/* actions: shrink-0, self-end on mobile / self-center on sm */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

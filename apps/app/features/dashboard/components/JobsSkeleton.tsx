import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "./ViewModeToggle";

export function JobsSkeleton({
  viewMode = "grid",
  showHeader = true,
}: {
  viewMode?: ViewMode;
  showHeader?: boolean;
}) {
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
              className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card px-3 py-7 shadow-xs sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <Skeleton className="h-14 w-24 shrink-0 rounded-lg sm:h-16 sm:w-28" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full max-w-64" />
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

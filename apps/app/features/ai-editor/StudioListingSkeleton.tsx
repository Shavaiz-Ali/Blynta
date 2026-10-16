import { AppSkeleton, type ViewMode } from "@blynta/ui";

export function StudioListingSkeleton({
  viewMode,
  count = 8,
}: {
  viewMode: ViewMode | null;
  count?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading AI Studio"
      className={
        viewMode === "list"
          ? "space-y-2.5"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      }
    >
      {Array.from({ length: count }, (_, index) =>
        viewMode === "list" ? (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-lg border border-border/80 bg-card px-3 py-7 shadow-xs sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <AppSkeleton className="h-16 w-28 shrink-0 rounded-md sm:h-20 sm:w-36" />
              <div className="min-w-0 flex-1 space-y-2">
                <AppSkeleton className="h-4 w-3/4" />
                <AppSkeleton className="h-3 w-24" />
                <AppSkeleton className="h-5 w-28" />
              </div>
            </div>
            <AppSkeleton className="h-8 w-28 self-end sm:self-center" />
          </div>
        ) : (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
          >
            <AppSkeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-3 p-4">
              <AppSkeleton className="h-4 w-full" />
              <AppSkeleton className="h-3 w-24" />
              <div className="flex justify-between border-t border-border/50 pt-2">
                <AppSkeleton className="h-5 w-28" />
                <AppSkeleton className="size-7" />
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

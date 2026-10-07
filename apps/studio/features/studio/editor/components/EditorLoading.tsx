import { AppSkeleton } from "@blynta/ui";

export function EditorLoading() {
  return (
    <main
      className="flex h-dvh gap-3 overflow-hidden bg-background p-3"
      aria-busy="true"
      aria-label="Loading editor"
    >
      <span className="sr-only" role="status">
        Loading your editor…
      </span>
      <div className="flex w-14 shrink-0 flex-col items-center gap-4 rounded-xl bg-sidebar py-4 ring-1 ring-border/60 md:w-[72px]">
        {Array.from({ length: 8 }, (_, i) => (
          <AppSkeleton key={i} className="size-9 rounded-lg" />
        ))}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <AppSkeleton className="h-12 shrink-0 rounded-xl" />
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] gap-3 max-[1099px]:grid-cols-[minmax(0,1fr)_300px] max-[979px]:grid-cols-1">
          <div className="space-y-4 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-border/60 max-[1099px]:hidden">
            <AppSkeleton className="h-5 w-28" />
            <AppSkeleton className="h-8" />
            {Array.from({ length: 5 }, (_, i) => (
              <AppSkeleton key={i} className="h-12" />
            ))}
          </div>
          <div className="flex min-h-0 flex-col gap-2 rounded-xl bg-card p-2 ring-1 ring-border/60">
            <div className="flex h-8 shrink-0 items-center justify-between px-1">
              <AppSkeleton className="h-5 w-32" />
              <AppSkeleton className="size-5" />
            </div>
            <AppSkeleton className="min-h-0 flex-1" />
            <AppSkeleton className="h-1 shrink-0" />
            <div className="flex h-10 shrink-0 items-center justify-between px-1">
              <AppSkeleton className="h-4 w-24" />
              <AppSkeleton className="h-8 w-28" />
              <AppSkeleton className="h-5 w-16" />
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-border/60 max-[979px]:hidden">
            <AppSkeleton className="h-8 w-32 shrink-0" />
            <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
              <AppSkeleton className="h-5 w-40" />
              <AppSkeleton className="h-10" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <AppSkeleton key={i} className="h-10" />
                ))}
              </div>
            </div>
            <AppSkeleton className="h-32 shrink-0 rounded-xl" />
          </div>
        </div>
        <div className="flex h-[34dvh] shrink-0 flex-col gap-3 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-border/60">
          <AppSkeleton className="h-9 shrink-0" />
          <div className="grid min-h-0 flex-1 grid-cols-[192px_minmax(0,1fr)] gap-3 max-md:grid-cols-[144px_minmax(0,1fr)]">
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <AppSkeleton key={i} className="h-14" />
              ))}
            </div>
            <div className="space-y-2">
              <AppSkeleton className="h-6" />
              {Array.from({ length: 4 }, (_, i) => (
                <AppSkeleton key={i} className="h-14 w-3/4" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

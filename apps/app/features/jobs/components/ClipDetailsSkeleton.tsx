import { AppSkeleton } from "@blynta/ui";

/** Mirrors ClipHeader, the 9:16 review stage, and the supporting content. */
export function ClipDetailsSkeleton() {
  return (
    <div
      className="w-full space-y-6 pb-14 [&_[data-slot=skeleton]]:animate-none"
      role="status"
      aria-label="Loading clip details"
    >
      <span className="sr-only">Loading clip details</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl border border-border/70 bg-card" />
          <div className="min-w-0 space-y-1.5">
            <AppSkeleton className="h-4 w-44 max-w-full" />
            <AppSkeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          <AppSkeleton className="h-9 min-w-9 flex-1 rounded-lg sm:w-24 sm:flex-none" />
          <AppSkeleton className="hidden h-9 w-20 rounded-lg md:block" />
          <AppSkeleton className="hidden h-9 w-28 rounded-lg lg:block" />
          <AppSkeleton className="h-9 w-32 shrink-0 rounded-lg" />
          <AppSkeleton className="h-9 min-w-20 flex-1 rounded-lg sm:w-28 sm:flex-none" />
          <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
        </div>
      </div>
      <section
        aria-hidden="true"
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.08] to-transparent" />
        <div className="relative grid items-center gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-10 lg:p-8">
          <div className="mx-auto w-full max-w-[18rem] lg:mx-0">
            <AppSkeleton className="aspect-[9/16] w-full rounded-xl ring-1 ring-border/80" />
          </div>
          <div className="flex min-w-0 flex-col gap-5 py-1 lg:py-4">
            <div className="flex flex-wrap gap-2">
              <AppSkeleton className="h-7 w-36 rounded-full" />
              <AppSkeleton className="h-7 w-24 rounded-full" />
              <AppSkeleton className="h-7 w-32 rounded-full" />
            </div>
            <div className="space-y-3">
              <AppSkeleton className="h-8 w-4/5 sm:h-9 lg:h-11" />
              <div className="space-y-2">
                <AppSkeleton className="h-4 w-full max-w-2xl" />
                <AppSkeleton className="h-4 w-3/4 max-w-2xl" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {["Source", "Duration", "Status"].map((label) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-background/50 p-3"
                >
                  <div className="h-4 w-4 shrink-0 rounded bg-muted" />
                  <div className="w-full min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    <AppSkeleton className="mt-0.5 h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AppSkeleton className="h-9 w-full rounded-lg sm:w-36" />
              <AppSkeleton className="h-3 w-48 max-w-full self-center sm:self-auto" />
            </div>
          </div>
        </div>
      </section>
      <div
        aria-hidden="true"
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]"
      >
        <div className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI insight
          </p>
          <AppSkeleton className="h-3 w-3/4" />
          <div className="space-y-2">
            <AppSkeleton className="h-4 w-full" />
            <AppSkeleton className="h-4 w-full" />
            <AppSkeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2 border-l-2 border-primary/50 py-1 pl-4">
            <AppSkeleton className="h-3 w-24" />
            <AppSkeleton className="h-5 w-4/5" />
          </div>
          <AppSkeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
            <div className="space-y-1">
              <p className="text-sm font-bold">Ready-to-publish content</p>
              <AppSkeleton className="h-3 w-48 max-w-full" />
            </div>
            <AppSkeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="grid gap-px bg-border/70 sm:grid-cols-2">
            {["Title", "Description", "Keywords", "Hashtags"].map((label) => (
              <div
                key={label}
                className={`min-w-0 space-y-2.5 bg-card px-5 py-4 sm:px-6 ${label === "Title" ? "sm:col-span-2" : label === "Description" ? "sm:row-span-2" : ""}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <AppSkeleton className="h-4 w-full" />
                <AppSkeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

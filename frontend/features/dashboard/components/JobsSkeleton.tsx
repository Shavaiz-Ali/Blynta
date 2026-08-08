import * as React from "react";

export function JobsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/70">
        <div className="space-y-1.5">
          <div className="h-5 w-28 bg-muted rounded-md animate-pulse" />
          <div className="h-3.5 w-44 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-3.5 w-16 bg-muted rounded-md animate-pulse" />
      </div>
      <div className="divide-y divide-border/70">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded-md animate-pulse" />
              <div className="h-3.5 w-40 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="hidden sm:block h-6 w-24 bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

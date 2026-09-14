"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivitySkeleton() {
  return (
    <div className="space-y-4 pb-16 animate-pulse">
      {/* Top summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-2"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Activity rows list skeleton */}
      <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden divide-y divide-border/20">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-64" />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

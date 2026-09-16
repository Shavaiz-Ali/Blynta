"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SourceVideoDetailsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Media Detail Header Lockup Skeleton ── */}
      <div className="space-y-4 pb-6 border-b border-border/70">
        {/* Back Link */}
        <Skeleton className="h-4 w-28 rounded-md" />

        {/* Source Media Banner Container */}
        <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
            {/* 16:9 Thumbnail Skeleton */}
            <div className="relative h-24 w-40 sm:h-28 sm:w-48 rounded-lg bg-muted/40 overflow-hidden shrink-0 border border-border/70">
              <Skeleton className="h-full w-full rounded-none" />
              <Skeleton className="absolute top-1.5 left-1.5 h-4 w-14 rounded bg-black/50" />
              <Skeleton className="absolute bottom-1.5 right-1.5 h-4 w-10 rounded bg-black/50" />
            </div>

            {/* Video metadata details */}
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>

              <Skeleton className="h-6 w-4/5 sm:w-2/3 rounded-md" />

              {/* Compact Stat Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Skeleton className="h-6 w-24 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded-lg" />
                <Skeleton className="h-6 w-28 rounded-lg" />
              </div>
            </div>
          </div>

          <Skeleton className="h-8 w-8 rounded-lg shrink-0 self-end sm:self-center" />
        </div>
      </div>

      {/* ── Generated Shorts Section Skeleton ── */}
      <div className="space-y-4">
        {/* Section Heading & Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        </div>

        {/* 4-Column Vertical 9:16 Clips Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/70 bg-card/60 overflow-hidden space-y-3 p-0"
            >
              {/* 9:16 Video Thumbnail Skeleton */}
              <div className="relative aspect-[9/16] w-full bg-muted/40">
                <Skeleton className="h-full w-full rounded-none" />
                <Skeleton className="absolute top-2.5 left-2.5 h-6 w-16 rounded-full" />
                <Skeleton className="absolute bottom-2.5 right-2.5 h-4 w-12 rounded-md" />
              </div>

              {/* Clip Details Skeleton */}
              <div className="p-3.5 pt-0 space-y-2.5">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-4/5 rounded-md" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-3/4 rounded-md" />
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

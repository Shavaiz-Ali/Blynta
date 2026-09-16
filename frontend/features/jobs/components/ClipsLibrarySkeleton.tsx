"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "@/features/dashboard/components/ViewModeToggle";

interface ClipsLibrarySkeletonProps {
  viewMode?: ViewMode;
}

export function ClipsLibrarySkeleton({ viewMode = "grid" }: ClipsLibrarySkeletonProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header Lockup Skeleton ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-56 rounded-lg" />
          <Skeleton className="h-4 w-64 sm:w-80 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg self-start md:self-auto shrink-0" />
      </div>

      {/* ── Filter Toolbar Skeleton ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
        </div>

        {/* Right: Search, Sort & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-9 w-full sm:w-[220px] rounded-lg" />
          <Skeleton className="h-9 w-[130px] rounded-lg" />
          <Skeleton className="h-9 w-[76px] rounded-lg" />
        </div>
      </div>

      {/* ── Media Grid or List Skeleton ── */}
      {viewMode === "list" ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <Skeleton className="h-16 w-28 sm:h-20 sm:w-36 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/70 bg-card/60 overflow-hidden space-y-3 p-0"
            >
              {/* 16:9 Thumbnail Skeleton */}
              <div className="relative aspect-video w-full">
                <Skeleton className="h-full w-full rounded-none" />
                <Skeleton className="absolute top-2.5 left-2.5 h-4 w-16 rounded-md" />
                <Skeleton className="absolute bottom-2.5 right-2.5 h-4 w-10 rounded-md" />
              </div>

              {/* Content Skeleton */}
              <div className="p-3.5 pt-0 space-y-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-md mt-1" />
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

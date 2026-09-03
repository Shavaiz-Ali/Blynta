"use client";

import * as React from "react";

export function JobDetailSkeleton() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6">
      {/* Top Bar Skeleton */}
      <div className="space-y-4 pb-4 border-b border-border/70">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="h-9 w-9 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-5 w-48 sm:w-64 rounded-md bg-muted animate-pulse" />
              <div className="h-3.5 w-32 sm:w-44 rounded-md bg-muted/60 animate-pulse" />
            </div>
          </div>
          <div className="h-7 w-24 rounded-full bg-muted animate-pulse shrink-0" />
        </div>

        {/* Clip Selector Tabs Skeleton */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/40">
            <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 3-Column Studio Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Insights & Transcript Skeleton */}
        <div className="lg:col-span-4 order-2 lg:order-1 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 rounded bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="flex items-center gap-4 py-1">
              <div className="h-20 w-20 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded bg-muted/60 animate-pulse" />
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-full rounded bg-muted/60 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Center Column (4 cols): Video Player Skeleton */}
        <div className="lg:col-span-4 order-1 lg:order-2 flex flex-col items-center justify-center">
          <div className="w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] rounded-2xl bg-muted/70 border border-border animate-pulse shadow-md flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-muted-foreground/20 animate-pulse" />
          </div>
        </div>

        {/* Right Column (4 cols): Metadata & Features Skeleton */}
        <div className="lg:col-span-4 order-3 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-full rounded bg-muted/60 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded bg-muted/60 animate-pulse" />
            </div>
            <div className="flex gap-1.5 pt-1">
              <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-md bg-muted animate-pulse" />
              <div className="h-5 w-14 rounded-md bg-muted animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/70">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-14 rounded bg-muted animate-pulse" />
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                <div className="h-2.5 w-14 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="pt-2">
              <div className="h-10 w-full rounded-xl bg-muted animate-pulse" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3 opacity-60">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-4 w-10 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-3 w-48 rounded bg-muted/60 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-muted/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

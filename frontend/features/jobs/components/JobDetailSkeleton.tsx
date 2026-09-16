"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ClipWorkspaceSkeleton() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* ── 1. Top Context & Action Bar Skeleton ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40 sm:w-56 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* ── 2. Hero 2-Column Workspace Skeleton (Large Video Left + AI Intelligence Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column (5 cols): Large 9:16 Video Player */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center gap-3 w-full">
          <div className="w-full max-w-[420px] sm:max-w-[440px] aspect-[9/16] rounded-lg bg-muted/60 border border-border p-4 flex flex-col items-center justify-between relative overflow-hidden">
            <Skeleton className="h-6 w-20 rounded-md self-start" />
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-8 w-full rounded-md bg-black/30" />
          </div>

          <div className="w-full max-w-[420px] sm:max-w-[440px] p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>

        {/* Right Column (7 cols): Identity & AI Intelligence */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6 w-full">
          {/* Identity Group */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3.5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-8 w-4/5 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />

            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          </div>

          <div className="h-px bg-border w-full" />

          {/* AI Virality Intelligence Skeleton */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>

            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* ── 3. Generated Shorts Rail Skeleton ── */}
      <div className="p-3 rounded-lg bg-card border border-border space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* ── 4. Publishing & Studio Grid Skeleton ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
        <div className="lg:col-span-7 rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

// Backward compatibility export
export const JobDetailSkeleton = ClipWorkspaceSkeleton;

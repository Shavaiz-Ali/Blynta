"use client";

import { AppCard } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";

/**
 * Loading state mirroring the clip review composition:
 * header, compact hero (video + clip information), then the AI insight and
 * publishing content cards.
 */
export function ClipWorkspaceSkeleton() {
  return (
    <div className="w-full space-y-6 pb-14" role="status" aria-label="Loading clip review">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      </div>

      {/* Compact hero */}
      <div className="grid items-center gap-6 rounded-2xl border border-border/80 bg-card p-4 sm:p-6 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-10 lg:p-8">
        <div className="mx-auto w-full max-w-[18rem] lg:mx-0">
          <AspectRatio ratio={9 / 16}>
            <Skeleton className="h-full w-full rounded-lg" />
          </AspectRatio>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-3 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-3/5" />
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-2/3 max-w-prose" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        <AppCard
          size="sm"
          title="AI insight"
          headerAction={<Skeleton className="h-5 w-28 rounded-md" />}
          contentClassName="px-3 pb-0"
        >
          <div className="grid w-full gap-x-8 gap-y-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-full max-w-prose" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </AppCard>

        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((card) => (
            <AppCard
              key={card}
              size="sm"
              title={<Skeleton className="h-3 w-24" />}
              contentClassName="px-3 pb-0"
            >
              <div className="space-y-1.5 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </AppCard>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

export const JobDetailSkeleton = ClipWorkspaceSkeleton;

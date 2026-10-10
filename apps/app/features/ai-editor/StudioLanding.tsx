"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clapperboard, ArrowUpRight, Sparkles } from "lucide-react";
import { AppButton as Button } from "@blynta/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useJobs, JobStatus } from "@/features/jobs";
import { useRecentPlans, studioError } from "./queries";
import { editTime } from "./presentation";
export function StudioLanding() {
  const [page, setPage] = useState(1);
  const jobs = useJobs({ status: JobStatus.COMPLETED, page, limit: 12 });
  const recent = useRecentPlans();
  const clips =
    jobs.data?.jobs.flatMap((job) =>
      job.clips
        .filter((c) => c.status === JobStatus.COMPLETED)
        .map((clip, index) => ({
          job,
          clip,
          title:
            job.highlights?.find(
              (h) =>
                h.startTime === clip.startTime && h.endTime === clip.endTime,
            )?.clipTitle || `Clip ${index + 1}`,
        })),
    ) ?? [];
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
        <header className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> AI Studio
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your next edit starts with a sentence.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose a generated clip, describe your edit, and review the
            suggestion. Render a preview when you’re ready.
          </p>
        </header>
        <section aria-labelledby="recent-edits">
          <h2 id="recent-edits" className="mb-4 text-lg font-semibold">
            Continue editing
          </h2>
          {recent.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : recent.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {studioError(recent.error)}{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void recent.refetch()}
                className="underline"
              >
                Retry
              </Button>
            </p>
          ) : !recent.data?.items.length ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Your editing sessions will appear here. Start with a clip below.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.data.items.map((plan) => (
                <Link
                  key={plan._id}
                  href={`/studio/${plan.sourceClipId}?jobId=${plan.sourceJobId}`}
                  className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      Edited clip · Revision {plan.revision}
                    </p>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {editTime(plan.outputDuration)} ·{" "}
                    {plan.latestPreview
                      ? `Preview ${plan.latestPreview.status} · r${plan.latestPreview.revision}`
                      : "No preview yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last edited {new Date(plan.updatedAt).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="editable-clips">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="editable-clips" className="text-lg font-semibold">
              Start from a generated clip
            </h2>
            <Link
              href="/my-clips"
              className="text-xs text-primary hover:underline"
            >
              All clips
            </Link>
          </div>
          {jobs.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : jobs.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {studioError(jobs.error)}{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void jobs.refetch()}
                className="underline"
              >
                Retry
              </Button>
            </p>
          ) : !clips.length ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Clapperboard className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h3 className="font-medium">No completed clips on this page</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate clips from your source video to start editing.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                Create clips
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clips.map(({ job, clip, title }) => (
                <Link
                  key={`${job._id}-${clip._id}`}
                  href={`/studio/${clip._id}?jobId=${job._id}`}
                  className="group overflow-hidden rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="relative flex aspect-video items-center justify-center bg-muted">
                    {job.thumbnailUrl ? (
                      <Image
                        unoptimized
                        src={job.thumbnailUrl}
                        alt="Source video thumbnail"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Clapperboard className="size-10 text-muted-foreground/50" />
                    )}
                    <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-2 py-1 text-xs">
                      {editTime(clip.endTime - clip.startTime)}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-medium">{title}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.videoTitle || "Generated video"}
                    </p>
                    <p className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                      Start editing <ArrowUpRight className="size-3.5" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!jobs.data || page >= jobs.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

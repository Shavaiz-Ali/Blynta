"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Job, JobStatus } from "@/features/jobs";
import { AppButton } from "@/components/common/AppButton";
import { cn } from "@/lib/utils";
import {
  FilmIcon,
  PlusIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
  ClockIcon,
} from "../icons";
import {
  STATUS_META,
  platformIcon,
  truncateUrl,
  formatDate,
  getActiveJobs,
} from "../utils";

/* -------------------------------------------------------------------------- */
/*  Getting-started tips — only shown in empty state                          */
/* -------------------------------------------------------------------------- */

function EmptyStateTips() {
  const tips = [
    {
      icon: <YoutubeIcon className="h-4 w-4 text-[#FF0000]" />,
      title: "Long-form YouTube videos work best",
      desc: "Podcasts and talking-head clips yield the most engaging highlights.",
    },
    {
      icon: <CheckCircleIcon className="h-4 w-4" />,
      title: "Each job uses 1 credit",
      desc: "Free accounts get 5 credits/month. Upgrade for more + HD exports.",
    },
    {
      icon: <LightbulbIcon className="h-4 w-4" />,
      title: "Avoid heavy background music",
      desc: "Clean audio gives the AI sharper transcription and better clips.",
    },
  ];

  return (
    <ul className="space-y-3.5 mt-6 text-left">
      {tips.map((t, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {t.icon}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              {t.desc}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  JobsCard                                                                  */
/* -------------------------------------------------------------------------- */

export function JobsCard({
  jobs,
}: {
  jobs: Job[];
}) {
  const router = useRouter();
  const activeJobs = getActiveJobs(jobs);
  const completedOrFailed = jobs.filter(
    (j) =>
      j.status === JobStatus.COMPLETED || j.status === JobStatus.FAILED
  );

  /* ---- Empty state ---- */
  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
          <h3 className="font-semibold text-foreground">My Clips</h3>
          <span className="text-xs font-medium text-muted-foreground">
            0 jobs
          </span>
        </div>
        <div className="px-6 py-10 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FilmIcon className="h-8 w-8 text-primary" />
          </div>
          <h4 className="text-lg font-bold text-foreground">No clips yet</h4>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Paste a video link above and Blynta will find the best moments, cut
            vertical clips, and add captions automatically.
          </p>
          <EmptyStateTips />
        </div>
      </div>
    );
  }

  /* ---- Has jobs ---- */
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
        <div>
          <h3 className="font-semibold text-foreground">My Clips</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} total
          </p>
        </div>
      </div>

      {/* Active / in-progress jobs section */}
      {activeJobs.length > 0 && (
        <div className="border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-2 px-6 py-2.5">
            <ClockIcon className="h-3.5 w-3.5 text-chart-4" />
            <span className="text-xs font-semibold text-chart-4 uppercase tracking-wide">
              Processing
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-chart-4">
              <span className="h-1.5 w-1.5 rounded-full bg-chart-4 animate-pulse" />
              {activeJobs.length} in progress
            </span>
          </div>
          <ul className="divide-y divide-border/50">
            {activeJobs.map((j) => {
              const meta = STATUS_META[j.status];
              return (
                <li key={j.id}>
                  <button
                    onClick={() => router.push(`/jobs/${j.id}`)}
                    className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-accent/30 transition-colors text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card border border-border">
                      {platformIcon(j.sourcePlatform, "h-4 w-4")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {truncateUrl(j.sourceUrl, 55)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Started {formatDate(j.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0",
                        meta.chip
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", meta.dot)} />
                      {meta.label}
                    </span>
                    <ArrowRightIcon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Completed / failed jobs */}
      {completedOrFailed.length > 0 && (
        <ul className="divide-y divide-border/70">
          {completedOrFailed.map((j) => {
            const meta = STATUS_META[j.status];
            return (
              <li key={j.id}>
                <button
                  onClick={() => router.push(`/jobs/${j.id}`)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
                    {platformIcon(j.sourcePlatform, "h-5 w-5")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {truncateUrl(j.sourceUrl, 60)}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(j.createdAt)}</span>
                      <span>·</span>
                      <span className="capitalize">{j.sourcePlatform}</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                          meta.chip
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                      {j.status === JobStatus.FAILED && (
                        <span className="text-[11px] text-destructive flex items-center gap-1 max-w-[160px] truncate">
                          <AlertTriangleIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {j.errorMessage || "Processing failed"}
                          </span>
                        </span>
                      )}
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Only active jobs but no completed — soft message */}
      {activeJobs.length > 0 && completedOrFailed.length === 0 && (
        <div className="px-6 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            Your clips will appear here once processing is complete.
          </p>
        </div>
      )}
    </div>
  );
}

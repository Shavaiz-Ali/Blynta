"use client";
import Link from "next/link";
import type { Job } from "@/features/jobs/types";
import { processingSteps, percentage } from "@/features/jobs/processing-state";
import { getJobDisplayTitle } from "../utils";
import { ProcessingProgress } from "@/features/jobs/components/ClipProcessingCard";
export function ActivePipelineBanner({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((job) =>
    processingSteps.some((step) => step.status === job.status),
  );
  if (!active.length) return null;
  return (
    <div className="space-y-2">
      {active.map((job) => {
        const progress = percentage(job.progressPercent);
        return (
          <div
            key={job._id || job.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold">
                {getJobDisplayTitle(job, 50)}
              </p>
              <p className="text-muted-foreground">
                {
                  processingSteps.find((step) => step.status === job.status)
                    ?.label
                }
              </p>
            </div>
            {progress !== undefined && (
              <div className="w-32">
                <ProcessingProgress value={progress} label="Progress" />
              </div>
            )}
            <Link
              href={"/my-clips/" + (job._id || job.id)}
              className="font-semibold text-primary"
            >
              View
            </Link>
          </div>
        );
      })}
    </div>
  );
}

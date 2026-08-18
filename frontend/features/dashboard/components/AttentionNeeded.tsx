import * as React from "react";
import type { Job } from "@/features/jobs";
import { AlertTriangleIcon } from "../icons";
import { getFailedJobs, getJobDisplayTitle, platformIcon, truncateUrl } from "../utils";

export function AttentionNeeded({ jobs }: { jobs: Job[] }) {
  const failed = getFailedJobs(jobs);
  if (failed.length === 0) return null;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 bg-destructive/5 border-b border-destructive/20">
        <AlertTriangleIcon className="h-4 w-4 text-destructive" />
        <h4 className="font-semibold text-sm text-foreground">
          Needs attention
        </h4>
        <span className="ml-auto text-xs font-medium text-destructive">
          {failed.length} failed
        </span>
      </div>
      <ul className="divide-y divide-border/70 max-h-72 overflow-auto">
        {failed.slice(0, 4).map((j) => (
          <li key={j.id} className="px-5 py-3 flex items-center gap-3">
            {platformIcon(j.sourcePlatform)}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {getJobDisplayTitle(j, 35)}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {j.errorMessage || "Processing failed — try again"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

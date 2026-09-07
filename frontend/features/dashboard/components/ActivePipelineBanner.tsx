"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Job, JobStatus } from "@/features/jobs";
import { getJobStageDetails, getJobDisplayTitle } from "../utils";
import { AppButton } from "@/components/common/AppButton";
import { ArrowRightIcon } from "../icons";
import { cn } from "@/lib/utils";

interface ActivePipelineBannerProps {
  jobs: Job[];
}

export function ActivePipelineBanner({ jobs }: ActivePipelineBannerProps) {
  const router = useRouter();

  const activeJob = jobs.find(
    (j) =>
      j.status === JobStatus.PENDING ||
      j.status === JobStatus.TRANSCRIBING ||
      j.status === JobStatus.DETECTING_HIGHLIGHTS ||
      j.status === JobStatus.CUTTING_CLIPS
  );

  if (!activeJob) return null;

  const stage = getJobStageDetails(activeJob.status, activeJob.progressPercent);
  const title = getJobDisplayTitle(activeJob, 50);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-primary/20 bg-primary/[0.04] text-xs">
      {/* Left: status info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Animated dot */}
        <div className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-foreground">
            Stage {stage.stageNumber}/{stage.totalStages}:{" "}
          </span>
          <span className="text-muted-foreground">{stage.title}</span>
          <span className="text-muted-foreground/50 mx-1.5">·</span>
          <span className="text-muted-foreground truncate">{title}</span>
        </div>
      </div>

      {/* Right: progress + link */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${stage.defaultPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-primary tabular-nums">
            {stage.defaultPercent}%
          </span>
        </div>
        <AppButton
          size="sm"
          variant="ghost"
          onClick={() => router.push(`/jobs/${activeJob._id}`)}
          className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
        >
          View
          <ArrowRightIcon className="h-3 w-3" />
        </AppButton>
      </div>
    </div>
  );
}

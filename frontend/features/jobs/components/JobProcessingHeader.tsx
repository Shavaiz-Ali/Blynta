"use client";

import * as React from "react";
import Link from "next/link";
import { Job, JobStatus } from "@/features/jobs/types";
import { PipelineStepper } from "./PipelineStepper";
import {
  TranscriptDialog,
  downloadTranscriptAsTxt,
} from "./TranscriptDialog";
import {
  platformIcon,
  getJobDisplayTitle,
  formatDate,
} from "@/features/dashboard/utils";
import {
  ChevronLeftIcon,
  DownloadIcon,
  TypeIcon,
  SparklesIcon,
  FilmIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { toast } from "sonner";

interface JobProcessingHeaderProps {
  job: Job;
}

const STAGE_DESCRIPTIONS: Record<string, { icon: React.ReactNode; label: string; tip: string }> = {
  [JobStatus.PENDING]: {
    icon: <DownloadIcon className="h-4 w-4" />,
    label: "Downloading Video",
    tip: "Fetching highest-quality source media for analysis.",
  },
  [JobStatus.TRANSCRIBING]: {
    icon: <TypeIcon className="h-4 w-4" />,
    label: "Transcribing Audio",
    tip: "Transcribing spoken speech with precise word timestamps.",
  },
  [JobStatus.DETECTING_HIGHLIGHTS]: {
    icon: <SparklesIcon className="h-4 w-4" />,
    label: "Detecting Viral Hooks",
    tip: "AI is analyzing conversation pacing and viral retention potential.",
  },
  [JobStatus.CUTTING_CLIPS]: {
    icon: <FilmIcon className="h-4 w-4" />,
    label: "Cutting & Captioning Clips",
    tip: "Re-framing into 9:16 vertical video and generating dynamic subtitles.",
  },
};

export function JobProcessingHeader({ job }: JobProcessingHeaderProps) {
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const activeStage = STAGE_DESCRIPTIONS[job.status] ?? STAGE_DESCRIPTIONS[JobStatus.PENDING];
  const hasTranscript = Boolean(job.transcript && job.transcript.length > 0);

  function handleQuickDownloadTranscript() {
    if (!job.transcript || job.transcript.length === 0) return;
    const title = getJobDisplayTitle(job, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadTranscriptAsTxt(job.transcript, `transcript-${title}.txt`);
    toast.success("Downloaded transcript (.txt)");
  }

  return (
    <>
      <div className="space-y-4 pb-5 border-b border-border/70">
        {/* Top bar: Back + Title + Live Pulse Badge + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href="/my-clips"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
              title="Back to My Clips"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border shadow-2xs">
              {platformIcon(job.sourcePlatform, "h-4.5 w-4.5")}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate leading-tight">
                {getJobDisplayTitle(job, 70)}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>Started {formatDate(job.createdAt)}</span>
                <span>·</span>
                <span className="capitalize">{job.sourcePlatform}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {/* Live Processing Indicator */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Studio Processing</span>
            </span>

            {/* Quick Download Transcript action when ready */}
            {hasTranscript && (
              <div className="flex items-center gap-1.5">
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={handleQuickDownloadTranscript}
                  icon={<DownloadIcon className="h-3.5 w-3.5" />}
                  className="h-8 text-xs font-medium"
                  title="Download full transcript (.txt)"
                >
                  Transcript (.txt)
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setTranscriptOpen(true)}
                  className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  View
                </AppButton>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Stepper Component */}
        <PipelineStepper
          status={job.status}
          progressPercent={job.progressPercent}
        />

        {/* Active Stage Live Banner */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-primary shrink-0 animate-pulse">
              {activeStage.icon}
            </span>
            <p className="text-muted-foreground truncate">
              <span className="font-semibold text-foreground">Current Stage: </span>
              <span className="text-foreground/90 font-medium">{activeStage.label}</span>
              <span className="hidden sm:inline text-muted-foreground/80"> — {activeStage.tip}</span>
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground/70 shrink-0 hidden md:inline">
            Auto-refreshes every 4s
          </span>
        </div>
      </div>

      {/* Transcript Modal Dialog if opened */}
      {hasTranscript && (
        <TranscriptDialog
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
          transcript={job.transcript}
          jobTitle={getJobDisplayTitle(job, 40)}
          jobId={job.id ?? job._id}
        />
      )}
    </>
  );
}

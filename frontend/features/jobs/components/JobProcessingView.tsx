"use client";

import * as React from "react";
import Link from "next/link";
import { Job, JobStatus } from "@/features/jobs/types";
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
  CheckCircleIcon,
  ClockIcon,
  ZapIcon,
  ArrowRightIcon,
  FolderIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import {
  TranscriptDialog,
  downloadTranscriptAsTxt,
} from "./TranscriptDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobProcessingViewProps {
  job: Job;
}

interface StepInfo {
  number: number;
  key: JobStatus;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepInfo[] = [
  {
    number: 1,
    key: JobStatus.PENDING,
    label: "Downloading Video",
    shortLabel: "Download",
    description: "Fetching highest-quality source media and audio stream.",
    icon: DownloadIcon,
  },
  {
    number: 2,
    key: JobStatus.TRANSCRIBING,
    label: "Transcribing Speech",
    shortLabel: "Transcribe",
    description: "Extracting word-level timestamps and speaker cues with Whisper AI.",
    icon: TypeIcon,
  },
  {
    number: 3,
    key: JobStatus.DETECTING_HIGHLIGHTS,
    label: "AI Virality & Highlight Detection",
    shortLabel: "AI Highlights",
    description: "Identifying 6–8 viral moments, retention hooks, and editor styles.",
    icon: SparklesIcon,
  },
  {
    number: 4,
    key: JobStatus.CUTTING_CLIPS,
    label: "Cutting & Captioning Clips",
    shortLabel: "Render & Caption",
    description: "Formatting to 9:16 vertical shorts with animated subtitle styling.",
    icon: FilmIcon,
  },
];

const STATUS_ORDER: Record<string, number> = {
  [JobStatus.PENDING]: 0,
  [JobStatus.TRANSCRIBING]: 1,
  [JobStatus.DETECTING_HIGHLIGHTS]: 2,
  [JobStatus.CUTTING_CLIPS]: 3,
  [JobStatus.COMPLETED]: 4,
};

export function JobProcessingView({ job }: JobProcessingViewProps) {
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const currentStepIndex = STATUS_ORDER[job.status] ?? 0;
  const activeStep = STEPS[Math.min(currentStepIndex, STEPS.length - 1)];
  const hasTranscript = Boolean(job.transcript && job.transcript.length > 0);

  // Overall approximate progress calculation
  const overallProgress = React.useMemo(() => {
    if (job.progressPercent && job.progressPercent > 0) {
      return Math.min(100, Math.round(job.progressPercent));
    }
    const baseProgressByStage: Record<string, number> = {
      [JobStatus.PENDING]: 15,
      [JobStatus.TRANSCRIBING]: 45,
      [JobStatus.DETECTING_HIGHLIGHTS]: 75,
      [JobStatus.CUTTING_CLIPS]: 90,
      [JobStatus.COMPLETED]: 100,
    };
    return baseProgressByStage[job.status] ?? 10;
  }, [job.status, job.progressPercent]);

  function handleQuickDownloadTranscript() {
    if (!job.transcript || job.transcript.length === 0) return;
    const title = getJobDisplayTitle(job, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadTranscriptAsTxt(job.transcript, `transcript-${title}.txt`);
    toast.success("Downloaded transcript (.txt)");
  }

  const ActiveIcon = activeStep.icon;

  return (
    <div className="w-full space-y-6">
      {/* ─── Top Bar: Navigation + Title + Real-time Status Badge ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/70">
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
              {job.videoUploader && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[150px]">{job.videoUploader}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span>AI Studio Processing</span>
          </div>

          {hasTranscript && (
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setTranscriptOpen(true)}
              icon={<TypeIcon className="h-3.5 w-3.5 text-primary" />}
              className="h-8 text-xs font-medium"
            >
              View Transcript
            </AppButton>
          )}
        </div>
      </div>

      {/* ─── Hero Card: Dynamic Generation Engine Visualizer ─── */}
      <div className="rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/70 p-6 sm:p-10 shadow-lg relative overflow-hidden space-y-8">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Central Active Stage Graphic & Headline */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-5 max-w-lg mx-auto">
          {/* Animated Halo Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute h-24 w-24 rounded-full bg-primary/15 animate-ping opacity-70" />
            <div className="absolute h-28 w-28 rounded-full border border-primary/20 animate-pulse" />
            <div className="relative flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/30 shadow-xl backdrop-blur-md text-primary">
              <ActiveIcon className="h-8 w-8 animate-bounce" />
            </div>
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-semibold uppercase tracking-wider border border-primary/20">
              Stage {activeStep.number} of {STEPS.length}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {activeStep.label}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {activeStep.description}
            </p>
          </div>

          {/* Smooth Overall Progress Bar */}
          <div className="w-full space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ZapIcon className="h-3.5 w-3.5 text-primary" />
                <span>Estimated Pipeline Progress</span>
              </span>
              <span className="font-bold text-foreground">{overallProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden border border-border/50">
              <div
                className="h-full bg-gradient-to-r from-primary/70 via-primary to-primary/90 rounded-full transition-all duration-700 ease-out shadow-xs"
                style={{ width: `${Math.max(5, overallProgress)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground/80 text-center font-sans">
              Auto-refreshing live progress · High-performance GPU pipeline active
            </p>
          </div>
        </div>

        {/* ─── 4-Stage Interactive Pipeline Stepper Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 pt-4 border-t border-border/60">
          {STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={step.key}
                className={cn(
                  "rounded-2xl p-4 border transition-all duration-300 flex flex-col justify-between gap-3",
                  isCurrent
                    ? "bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/30"
                    : isDone
                      ? "bg-muted/30 border-border/60 opacity-90"
                      : "bg-card/40 border-border/40 opacity-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold",
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : isDone
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {isDone ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                      isCurrent
                        ? "bg-primary/15 text-primary border-primary/25 animate-pulse"
                        : isDone
                          ? "bg-muted text-muted-foreground border-border/50"
                          : "bg-transparent text-muted-foreground/60 border-transparent"
                    )}
                  >
                    {isCurrent ? "Active" : isDone ? "Done" : "Pending"}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <StepIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{step.shortLabel}</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Bottom Info Card: Background Processing & Tips ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Cloud Processing Notice */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-primary">
            <ClockIcon className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Background Processing
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You can safely close this browser tab or navigate away. We process your video in the cloud and deliver finished clips to your library.
          </p>
        </div>

        {/* Card 2: AI Capabilities */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-primary">
            <SparklesIcon className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              What AI Delivers
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            6–8 viral vertical clips with 9:16 framing, retention hook scores, animated captions, SEO keywords, and social hashtags.
          </p>
        </div>

        {/* Card 3: Quick Navigation */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 flex flex-col justify-between gap-3 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
              <FolderIcon className="h-4 w-4 text-primary" />
              <span>Explore Other Clips</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Check out previous video clips while this one finishes rendering.
            </p>
          </div>
          <Link
            href="/my-clips"
            className="inline-flex items-center justify-between px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border/60 transition-colors"
          >
            <span>Go to My Clips</span>
            <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
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
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Job,
  JobStatus,
  useJob,
  useCreateJob,
  useDownloadClip,
  useDeleteClip,
  Highlight,
} from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  platformIcon,
  truncateUrl,
  getJobDisplayTitle,
  formatDate,
  PIPELINE_STEPS,
  getPipelineStepState,
  isProcessingStatus,
  formatTimestamp,
} from "@/features/dashboard/utils";
import {
  CheckIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  RefreshCwIcon,
  FilmIcon,
  TrashIcon,
  LockIcon,
} from "@/features/dashboard/icons";

/* -------------------------------------------------------------------------- */
/*                         id normalization helpers                           */
/* -------------------------------------------------------------------------- */
// Backend (Mongo) sends `_id`; some types/callers assume `id`. Normalize once
// here so every call site (download, delete, key, loading-state) agrees on
// the same value instead of drifting out of sync.

function getClipId(clip: Job["clips"][number]): string {
  return (clip as any)._id ?? (clip as any).id;
}

function getJobId(job: Job): string {
  return (job as any).id ?? (job as any)._id;
}

/* -------------------------------------------------------------------------- */
/*                         PipelineStepper                                    */
/* -------------------------------------------------------------------------- */

export function PipelineStepper({
  status,
  progressPercent,
}: {
  status: JobStatus;
  progressPercent?: number;
}) {
  if (!isProcessingStatus(status)) return null;

  const visibleSteps = PIPELINE_STEPS.filter(
    (s) => s.key !== JobStatus.COMPLETED
  );

  return (
    <div className="w-full rounded-2xl border border-border bg-card/60 px-4 sm:px-5 py-3.5 overflow-x-auto">
      <ol className="flex items-center gap-1 sm:gap-2 min-w-max">
        {visibleSteps.map((step, idx) => {
          const state = getPipelineStepState(step.key, status);
          const isLast = idx === visibleSteps.length - 1;
          const doneAfter = isStepDoneAfter(step.key, status);

          const isProgressCapable =
            step.key === JobStatus.PENDING || step.key === JobStatus.TRANSCRIBING;
          const showProgress = isProgressCapable && state === "active";
          const pct = Math.min(100, Math.max(0, Math.round(progressPercent ?? 0)));

          return (
            <React.Fragment key={step.key}>
              <li className="flex items-center gap-2 shrink-0">
                <div
                  className={cn(
                    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all",
                    state === "done" &&
                    "bg-chart-1/15 border-chart-1/40 text-chart-1",
                    state === "active" &&
                    "bg-primary/15 border-primary/40 text-primary",
                    state === "pending" &&
                    "bg-muted/50 border-border/60 text-muted-foreground/60"
                  )}
                >
                  {state === "active" && (
                    <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                  )}
                  <span className="relative">
                    {state === "done" ? (
                      <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                </div>
                <div className="flex flex-col min-w-[70px]">
                  <span
                    className={cn(
                      "text-xs font-medium whitespace-nowrap",
                      state === "done" && "text-foreground",
                      state === "active" && "text-primary font-semibold",
                      state === "pending" && "text-muted-foreground/60"
                    )}
                  >
                    {step.label}
                    {showProgress ? (
                      <span className="ml-1.5 font-bold text-primary tabular-nums">
                        {pct}%
                      </span>
                    ) : (
                      state === "active" && (
                        <span className="ml-0.5 text-primary/70">…</span>
                      )
                    )}
                  </span>
                  {showProgress && (
                    <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </li>
              {!isLast && (
                <li
                  aria-hidden
                  className={cn(
                    "w-5 sm:w-9 h-px shrink-0 transition-colors",
                    doneAfter ? "bg-chart-1/40" : "bg-border/60"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function isStepDoneAfter(stepKey: JobStatus, status: JobStatus): boolean {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stepKey);
  const cur = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx < cur;
}

/* -------------------------------------------------------------------------- */
/*                       FailedStateCard                                      */
/* -------------------------------------------------------------------------- */

export function FailedStateCard({ job }: { job: Job }) {
  const router = useRouter();
  const createJob = useCreateJob({
    onSuccess: (data: Job) => {
      router.push(`/jobs/${getJobId(data)}`);
    },
  });

  const stageLabel: Record<string, string> = {
    download: "Downloading the video",
    transcription: "Transcribing audio",
    highlight_detection: "Detecting highlights",
    cutting_clips: "Cutting & captioning clips",
    unknown: "Processing",
  };
  const stage = job.errorStage ?? "unknown";

  function handleRetry() {
    createJob.mutate({
      sourceUrl: job.sourceUrl,
      sourcePlatform: job.sourcePlatform,
    });
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            This job couldn&apos;t be processed
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {stageLabel[stage] ?? "Processing"} ran into an error.
          </p>

          <div className="mt-3 rounded-xl bg-card/60 border border-border/70 p-3 sm:p-4 space-y-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Stage
              </span>
              <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
                {stage}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Error
              </span>
              <p className="text-sm text-destructive/90 break-words mt-0.5">
                {job.errorMessage || "An unknown error occurred."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <AppButton
              onClick={handleRetry}
              isLoading={createJob.isPending}
              icon={<RefreshCwIcon className="h-4 w-4" />}
              size="sm"
            >
              Try again (new job)
            </AppButton>
            <p className="text-[11px] text-muted-foreground sm:ml-1">
              Creates a fresh job with the same URL · uses 1 credit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         ClipDescription                                    */
/* -------------------------------------------------------------------------- */

function ClipDescription({ highlight }: { highlight?: Highlight }) {
  const { data: user } = useCurrentUser();

  if (highlight?.clipDescription) {
    // Backend sent a description — user is Pro/Business. Show it.
    return (
      <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
        {highlight.clipDescription}
      </p>
    );
  }

  // No description in response. Only show upsell if we've confirmed it's a free-plan user.
  if (user?.plan === "free") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <LockIcon className="h-3 w-3 shrink-0" />
        <span>Clip descriptions available on </span>
        <Link href="/billing" className="text-primary font-medium hover:underline">
          Pro
        </Link>
      </div>
    );
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                           ClipCard                                         */
/* -------------------------------------------------------------------------- */

function ClipCard({
  clip,
  index,
  jobId,
  highlight,
  isTopPick,
  downloadingId,
  onDownload,
}: {
  clip: Job["clips"][number];
  index: number;
  jobId: string;
  highlight?: Highlight;
  isTopPick?: boolean;
  downloadingId: string | null;
  onDownload: (clip: Job["clips"][number]) => void;
}) {
  const deleteClip = useDeleteClip();
  const downloadClip = useDownloadClip();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const clipId = getClipId(clip);

  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        const { signedUrl } = await downloadClip.mutateAsync({ jobId, clipId });
        if (cancelled) return;
        setPreviewSrc(signedUrl);
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId, jobId]);

  function handleDelete() {
    deleteClip.mutate(
      { jobId, clipId },
      {
        onSuccess: () => {
          toast.success("Clip deleted.");
          setDeleteOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to delete clip.");
          setDeleteOpen(false);
        },
      }
    );
  }

  const duration = formatTimestamp(clip.endTime - clip.startTime);
  const matchScore =
    typeof highlight?.score === "number"
      ? `${(highlight.score * 100).toFixed(0)}%`
      : null;

  return (
    <>
      <div className="group rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-border/80 transition-all duration-200">
        <div className="relative aspect-[4/5] w-full bg-black overflow-hidden shrink-0">
          {previewSrc ? (
            <video
              src={previewSrc}
              preload="metadata"
              controls
              playsInline
              className="h-full w-full object-contain"
            />
          ) : previewError ? (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-xs text-muted-foreground/70">
                Preview unavailable
              </span>
            </div>
          ) : (
            <div className="h-full w-full animate-pulse bg-muted/30" />
          )}

          {isTopPick && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-chart-4/95 text-chart-4-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md z-10 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Top Pick
            </div>
          )}

          {matchScore && !isTopPick && (
            <div className="absolute top-3 left-3 inline-flex items-center rounded-full bg-background/90 text-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md z-10 backdrop-blur-sm border border-border/60">
              {matchScore} match
            </div>
          )}

          <div className="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-black/70 text-white px-2 py-0.5 text-[10px] font-semibold tabular-nums z-10 backdrop-blur-sm">
            {duration}
          </div>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 hover:bg-destructive text-white flex items-center justify-center transition-all duration-200 cursor-pointer z-10 backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100"
            title="Delete clip"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>

          {clip.status === JobStatus.FAILED && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-destructive" />
                <span className="text-xs font-semibold text-destructive">
                  Clip failed to render
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col p-4 sm:p-5 gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
              {highlight?.clipTitle?.trim() || `Clip ${index + 1}`}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {clip.hasCaptions && (
                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-primary/20">
                  CC
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/60 font-mono">{duration}</span>
          </div>

          <ClipDescription highlight={highlight} />

          <div className="mt-auto pt-2">
            <AppButton
              size="sm"
              onClick={() => onDownload(clip)}
              isLoading={downloadingId === clipId}
              icon={
                downloadingId === clipId ? undefined : (
                  <DownloadIcon className="h-4 w-4" />
                )
              }
              className="w-full h-9 text-xs font-semibold"
            >
              Download MP4
            </AppButton>
          </div>
        </div>
      </div>

      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        size="sm"
        title="Delete this clip?"
        description="This will permanently delete this clip file from disk. This cannot be undone."
        footer={
          <div className="flex w-full gap-2 justify-end">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteClip.isPending}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              size="sm"
              isLoading={deleteClip.isPending}
              onClick={handleDelete}
            >
              Delete
            </AppButton>
          </div>
        }
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                           ClipsGrid                                         */
/* -------------------------------------------------------------------------- */

export function ClipsGrid({ job }: { job: Job }) {
  const downloadClip = useDownloadClip();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const jobId = getJobId(job);

  // Total expected clips is known once highlights exist, even before any clip
  // is cut — use that as the slot count so skeletons appear immediately at the
  // start of Stage 4, not just "0 clips" until the first one finishes.
  const expectedCount = job.highlights?.length ?? 0;
  if (expectedCount === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-8 sm:p-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 mb-4">
          <FilmIcon className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-foreground/70">
          No finished clips yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clips will appear here once processing is complete.
        </p>
      </div>
    );
  }

  const scores = job.highlights
    .map((h) => (typeof h.score === "number" ? h.score : -1));
  const maxScore = scores.length > 0 ? Math.max(...scores) : -1;

  async function handleDownload(clip: Job["clips"][number]) {
    const clipId = getClipId(clip);
    try {
      setDownloadingId(clipId);
      toast.info("Preparing clip download...");
      const { signedUrl } = await downloadClip.mutateAsync({
        jobId,
        clipId,
      });
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = `blynta-clip-${clipId}.mp4`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Clip download started!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download clip. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: expectedCount }).map((_, i) => {
        const clip = job.clips[i]; // present once that index's DB write has landed
        const highlight = job.highlights[i];

        if (!clip) {
          return <ClipCardSkeleton key={`skeleton-${i}`} index={i} />;
        }
        if (clip.status === JobStatus.FAILED) {
          return <ClipCardFailed key={getClipId(clip) || i} index={i} />;
        }

        const isTopPick =
          typeof highlight?.score === "number" &&
          highlight.score === maxScore &&
          maxScore > 0;

        return (
          <ClipCard
            key={getClipId(clip) || i}
            clip={clip}
            index={i}
            jobId={jobId}
            highlight={highlight}
            isTopPick={isTopPick}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        );
      })}
    </div>
  );
}

function ClipCardSkeleton({ index }: { index: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-[4/5] w-full bg-muted/40 animate-pulse" />
      <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col">
        <div className="h-4 w-3/4 rounded-md bg-muted/60 animate-pulse" />
        <div className="h-3 w-1/3 rounded-md bg-muted/40 animate-pulse" />
        <div className="mt-auto pt-2">
          <div className="h-9 w-full rounded-xl bg-muted/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function ClipCardFailed({ index }: { index: number }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 aspect-[4/5] flex items-center justify-center p-4">
      <div className="flex items-center gap-2 text-center">
        <AlertTriangleIcon className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs font-semibold text-destructive">
          Clip {index + 1} failed to render
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         TranscriptSection                                   */
/* -------------------------------------------------------------------------- */

export function TranscriptSection({
  transcript,
}: {
  transcript: Job["transcript"];
}) {
  const [open, setOpen] = React.useState(false);

  if (!transcript || transcript.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-accent/30 transition-colors text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Full transcript
          </span>
          <span className="text-xs text-muted-foreground">
            {transcript.length} segments
          </span>
        </div>
        {open ? (
          <ChevronUpIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/70 max-h-[420px] overflow-y-auto px-4 sm:px-5 py-3 space-y-1.5 bg-muted/10">
          {transcript.map((seg, i) => (
            <div key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="shrink-0 min-w-[56px] text-[11px] font-mono text-muted-foreground/70 pt-0.5 tabular-nums">
                [{formatTimestamp(seg.startTime)}]
              </span>
              <p className="text-foreground/85 flex-1">{seg.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                      JobDetailContent (client component)                   */
/* -------------------------------------------------------------------------- */

export function JobDetailContent({ jobId }: { jobId: string }) {
  const { data: job, isLoading, error } = useJob(jobId);

  if (error && !job) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8">
        <FailedErrorInline message={(error as Error).message} />
      </div>
    );
  }

  if (isLoading || !job) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        <div className="space-y-3 sm:space-y-4">
          <div className="h-5 w-24 rounded-lg bg-muted animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-2xl bg-muted animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[job.status];
  const hasHighlights = job.highlights && job.highlights.length > 0;
  const hasClips = job.clips && job.clips.length > 0;
  const showCompletedContent =
    job.status === JobStatus.COMPLETED || hasHighlights || hasClips;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border">
            {platformIcon(job.sourcePlatform, "h-5 w-5")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-foreground truncate">
              {getJobDisplayTitle(job, 80)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="capitalize">{job.sourcePlatform}</span>
              <span>·</span>
              <span>{formatDate(job.createdAt)}</span>
              {job.resolutionUsed && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono text-[11px] font-medium border border-border/40">
                    {job.resolutionUsed}
                  </span>
                </>
              )}
              <span>·</span>
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/60 hover:text-primary transition-colors truncate max-w-[180px]"
                title={job.sourceUrl}
              >
                {truncateUrl(job.sourceUrl, 40)}
              </a>
            </div>
          </div>
        </div>
        <span
          className={cn(
            "self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shrink-0",
            meta.chip
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isProcessingStatus(job.status) && "animate-pulse",
              meta.dot
            )}
          />
          {meta.label}
        </span>
      </div>

      {/* Pipeline stepper (only when processing) */}
      <PipelineStepper status={job.status} progressPercent={job.progressPercent} />

      {/* Failed state */}
      {job.status === JobStatus.FAILED && <FailedStateCard job={job} />}

      {/* Processing-only empty card (no clips, highlights, or transcript yet) */}
      {isProcessingStatus(job.status) &&
        job.transcript.length === 0 &&
        !hasHighlights &&
        !hasClips && (
          <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
              <FilmIcon className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Processing your video…
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              This usually takes 2–10 minutes depending on length. You can
              safely close this tab — results will appear on your dashboard when ready.
            </p>
          </div>
        )}

      {/* Completed / has content */}
      {showCompletedContent && (
        <>
          {(hasHighlights || hasClips) && (
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                    Your clips
                  </h2>
                  <span className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-2 rounded-full bg-muted text-muted-foreground text-[11px] font-bold border border-border/70">
                    {job.clips.filter((c) => c.status === JobStatus.COMPLETED).length}
                    {hasHighlights && ` / ${job.highlights.length}`}
                  </span>
                </div>
              </div>
              <ClipsGrid job={job} />
            </section>
          )}

          <TranscriptSection transcript={job.transcript ?? []} />
        </>
      )}

      {/* Processing — transcript ready but not yet highlights or clips */}
      {isProcessingStatus(job.status) &&
        !showCompletedContent &&
        job.transcript.length > 0 && (
          <TranscriptSection transcript={job.transcript} />
        )}
    </div>
  );
}

function FailedErrorInline({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Couldn&apos;t load this job
          </h3>
          <p className="mt-1 text-xs text-muted-foreground break-words">
            {message || "It may not exist or you don&apos;t have permission to view it."}
          </p>
        </div>
      </div>
    </div>
  );
}
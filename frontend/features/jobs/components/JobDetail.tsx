"use client";

import * as React from "react";
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
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  platformIcon,
  truncateUrl,
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
} from "@/features/dashboard/icons";

/* -------------------------------------------------------------------------- */
/*                         PipelineStepper                                    */
/* -------------------------------------------------------------------------- */

export function PipelineStepper({ status }: { status: JobStatus }) {
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
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    state === "done" && "text-foreground",
                    state === "active" && "text-primary font-semibold",
                    state === "pending" && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                  {state === "active" && (
                    <span className="ml-0.5 text-primary/70">…</span>
                  )}
                </span>
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
      router.push(`/jobs/${data.id}`);
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
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  function handleDelete() {
    deleteClip.mutate(
      { jobId, clipId: clip.id || (clip as any)._id },
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

  return (
    <>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col group relative">
        <div className="relative aspect-[9/16] w-full bg-black overflow-hidden">
          <video
            src={clip.downloadUrl}
            preload="metadata"
            controls
            playsInline
            className="h-full w-full object-cover"
          />
          {isTopPick && (
            <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-chart-4 text-chart-4-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm z-10">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Top pick
            </div>
          )}
          {/* Delete clip button top-right */}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-black/60 hover:bg-destructive text-white flex items-center justify-center transition-colors cursor-pointer z-10 backdrop-blur-sm shadow-sm"
            title="Delete clip"
          >
            <TrashIcon className="h-4 w-4" />
          </button>

          {clip.status === JobStatus.FAILED && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <span className="text-xs font-semibold text-destructive">
                Clip failed to render
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col p-4 gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Clip {index + 1} · {formatTimestamp(clip.endTime - clip.startTime)}
            </span>
            {typeof highlight?.score === "number" && !isTopPick && (
              <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                {(highlight.score * 100).toFixed(0)}% match
              </span>
            )}
          </div>

          {highlight?.reason && (
            <p className="text-xs text-foreground/80 line-clamp-3">
              “{highlight.reason}”
            </p>
          )}

          <AppButton
            size="sm"
            onClick={() => onDownload(clip)}
            isLoading={downloadingId === clip.id}
            icon={
              downloadingId === clip.id ? undefined : (
                <DownloadIcon className="h-4 w-4" />
              )
            }
            className="mt-auto w-full"
          >
            Download MP4
          </AppButton>
        </div>
      </div>

      {/* Delete clip confirmation dialog */}
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
  const finishedClips = job.clips.filter(
    (c) => c.status === JobStatus.COMPLETED
  );
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const downloadClip = useDownloadClip();

  if (finishedClips.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
        <FilmIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No finished clips yet.
        </p>
      </div>
    );
  }

  const scores = job.highlights
    .map((h) => (typeof h.score === "number" ? h.score : -1));
  const maxScore = scores.length > 0 ? Math.max(...scores) : -1;

  async function handleDownload(clip: Job["clips"][number]) {
    try {
      setDownloadingId(clip.id);
      toast.info("Preparing clip download...");
      const blob = await downloadClip.mutateAsync({
        jobId: job.id,
        clipId: clip.id,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blynta-clip-${clip.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Clip download started!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download clip. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {finishedClips.map((clip, i) => {
        const highlight = job.highlights[i];
        const isTopPick =
          typeof highlight?.score === "number" &&
          highlight.score === maxScore &&
          maxScore > 0;

        return (
          <ClipCard
            key={clip.id || (clip as any)._id || i}
            clip={clip}
            index={i}
            jobId={job.id || job._id}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] rounded-2xl bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const meta = STATUS_META[job.status];
  const showCompletedContent =
    job.status === JobStatus.COMPLETED || job.clips.length > 0;

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
              {truncateUrl(job.sourceUrl, 80)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="capitalize">{job.sourcePlatform}</span>
              <span>·</span>
              <span>{formatDate(job.createdAt)}</span>
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
      <PipelineStepper status={job.status} />

      {/* Failed state */}
      {job.status === JobStatus.FAILED && <FailedStateCard job={job} />}

      {/* Processing-only empty card (no clips or transcript yet) */}
      {isProcessingStatus(job.status) &&
        job.transcript.length === 0 &&
        job.clips.length === 0 && (
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
          {job.clips.length > 0 && (
            <section>
              <h2 className="text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4">
                Your clips
              </h2>
              <ClipsGrid job={job} />
            </section>
          )}

          <TranscriptSection transcript={job.transcript ?? []} />
        </>
      )}

      {/* Processing — transcript ready but not yet complete */}
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

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Job,
  JobStatus,
  useJobs,
  useDeleteJob,
  useRetryJob,
} from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { JobsSkeleton } from "@/features/dashboard/components/JobsSkeleton";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  platformIcon,
  truncateUrl,
  getJobDisplayTitle,
  formatDate,
  getActiveJobs,
  isProcessingStatus,
} from "@/features/dashboard/utils";
import {
  FilmIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  YoutubeIcon,
  CheckCircleIcon,
  LightbulbIcon,
  ClockIcon,
  RefreshCwIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/features/dashboard/icons";

/* -------------------------------------------------------------------------- */
/*  Filter config                                                              */
/* -------------------------------------------------------------------------- */

type FilterValue = "all" | "processing" | JobStatus.COMPLETED | JobStatus.FAILED;

const ACTIVE_STATUSES: JobStatus[] = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: JobStatus.COMPLETED },
  { label: "Failed", value: JobStatus.FAILED },
];

/* -------------------------------------------------------------------------- */
/*  Empty-state tips (full onboarding — shown only when zero jobs at all)     */
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
/*  ConfirmDialog — generic reusable confirmation                             */
/* -------------------------------------------------------------------------- */

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  isLoading?: boolean;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  isLoading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={title}
      description={description}
      footer={
        <div className="flex w-full gap-2 justify-end">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </AppButton>
          <AppButton
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            size="sm"
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AppButton>
        </div>
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  JobRow — a single job row with status, actions                            */
/* -------------------------------------------------------------------------- */

function JobRow({ job }: { job: Job }) {
  const router = useRouter();
  const deleteJob = useDeleteJob();
  const retryJob = useRetryJob();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [retryOpen, setRetryOpen] = React.useState(false);

  const meta = STATUS_META[job.status];
  const active = isProcessingStatus(job.status);
  const canDelete =
    job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED;
  const canRetry = job.status === JobStatus.FAILED;

  function handleDelete() {
    deleteJob.mutate(job.id || job._id, {
      onSuccess: () => {
        toast.success("Job deleted.");
        setDeleteOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete job.");
        setDeleteOpen(false);
      },
    });
  }

  function handleRetry() {
    retryJob.mutate(job.id || job._id, {
      onSuccess: (newJob) => {
        toast.success("Retry started — 1 credit used.");
        setRetryOpen(false);
        router.push(`/jobs/${newJob.id || newJob._id}`);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to retry job.");
        setRetryOpen(false);
      },
    });
  }

  return (
    <>
      <li className="flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-accent/30 transition-colors">
        {/* Main clickable area for job info */}
        <button
          type="button"
          onClick={() => router.push(`/jobs/${job.id || job._id}`)}
          className="flex-1 flex items-center gap-3 sm:gap-4 min-w-0 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg p-0.5 -m-0.5"
        >
          {/* Platform icon */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
            {platformIcon(job.sourcePlatform, "h-5 w-5")}
          </div>

          {/* URL + meta */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {getJobDisplayTitle(job, 60)}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{formatDate(job.createdAt)}</span>
              <span>·</span>
              <span className="capitalize">{job.sourcePlatform}</span>
              {job.clips.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {job.clips.filter((c) => c.status === JobStatus.COMPLETED).length} clip
                    {job.clips.filter((c) => c.status === JobStatus.COMPLETED).length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* Right side items: Status badge + Retry button + Delete button + Arrow */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Error snippet */}
          {job.status === JobStatus.FAILED && job.errorMessage && (
            <span className="hidden xl:flex items-center gap-1 text-[11px] text-destructive max-w-[160px] truncate">
              <AlertTriangleIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.errorMessage}</span>
            </span>
          )}

          {/* Status badge */}
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              meta.chip
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active && "animate-pulse",
                meta.dot
              )}
            />
            {meta.label}
          </span>

          {/* Action: Retry */}
          {canRetry && (
            <button
              type="button"
              onClick={() => setRetryOpen(true)}
              title="Retry job (costs 1 credit)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Retry</span>
            </button>
          )}

          {/* Action: Delete */}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              title="Delete job"
              className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push(`/jobs/${job.id || job._id}`)}
            className="text-muted-foreground/50 hover:text-foreground p-1 transition-colors cursor-pointer hidden sm:block"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </li>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this job?"
        description="This will permanently delete the job and all its clips from disk. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        isLoading={deleteJob.isPending}
        onConfirm={handleDelete}
      />

      {/* Retry confirmation */}
      <ConfirmDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        title="Retry this job?"
        description="This creates a fresh processing job using the same video URL. It will use 1 credit from your balance."
        confirmLabel="Retry — use 1 credit"
        confirmVariant="default"
        isLoading={retryJob.isPending}
        onConfirm={handleRetry}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  MyClipsClient — full page component wrapped in DashboardLayout           */
/* -------------------------------------------------------------------------- */

export function MyClipsClient() {
  const router = useRouter();
  const { data: profile } = useCurrentUser();
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [page, setPage] = React.useState(1);
  const LIMIT = 20;

  // For "processing" filter: fetch all (no status param), then filter client-side.
  // For all other filters, pass status directly to the backend for efficient DB-level filtering.
  const apiStatus =
    filter === "all" || filter === "processing"
      ? undefined
      : (filter as JobStatus);

  const { data, isLoading, error } = useJobs({
    status: apiStatus,
    page,
    limit: LIMIT,
  });

  const allJobs = data?.jobs ?? [];
  const jobs =
    filter === "processing"
      ? allJobs.filter((j) => ACTIVE_STATUSES.includes(j.status))
      : allJobs;

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const activeJobs = getActiveJobs(jobs);
  const completedOrFailed = jobs.filter(
    (j) => j.status === JobStatus.COMPLETED || j.status === JobStatus.FAILED
  );

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setPage(1);
  }, [filter]);

  const headerContent = (
    <div className="flex-1 min-w-0 flex items-center">
      {profile ? (
        <DashboardHeaderRight profile={profile} />
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 space-y-6">
        {/* Header row with page title & Filter pills */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              My Clips<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and download your generated video clips.
            </p>
          </div>

          {/* Filter Pills Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 self-start sm:self-auto overflow-x-auto max-w-full">
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer",
                    active
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        {isLoading ? (
          <JobsSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm text-center">
            <AlertTriangleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load your clips
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as any)?.message || "Please refresh the page to try again."}
            </p>
          </div>
        ) : filter === "all" && total === 0 ? (
          /* Zero jobs TOTAL (no filter) — full onboarding empty state */
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
              <h2 className="font-semibold text-foreground">My Clips</h2>
              <span className="text-xs font-medium text-muted-foreground">
                0 clips
              </span>
            </div>
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <FilmIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No clips yet</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Paste a video link on the{" "}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="underline hover:text-foreground transition-colors cursor-pointer"
                >
                  dashboard
                </button>{" "}
                and Blynta will find the best moments, cut vertical clips, and add
                captions automatically.
              </p>
              <EmptyStateTips />
            </div>
          </div>
        ) : jobs.length === 0 ? (
          /* Jobs filtered to zero (but jobs DO exist) — simple empty state */
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
              <FilmIcon className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                No{" "}
                {FILTER_OPTIONS.find((f) => f.value === filter)?.label.toLowerCase()}{" "}
                clips
              </p>
              <p className="text-xs text-muted-foreground">
                Try switching to a different filter.
              </p>
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
                className="mt-1"
              >
                Show all clips
              </AppButton>
            </div>
          </div>
        ) : (
          /* Has jobs list */
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Card header: total count */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
              <div>
                <h2 className="font-semibold text-foreground">My Clips</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} {total === 1 ? "job" : "jobs"} total
                </p>
              </div>
            </div>

            {/* Active jobs sub-section */}
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
                  {activeJobs.map((j) => (
                    <JobRow key={j.id || j._id} job={j} />
                  ))}
                </ul>
              </div>
            )}

            {/* Completed / failed jobs */}
            {completedOrFailed.length > 0 && (
              <ul className="divide-y divide-border/70">
                {completedOrFailed.map((j) => (
                  <JobRow key={j.id || j._id} job={j} />
                ))}
              </ul>
            )}

            {/* Soft message when only active jobs */}
            {activeJobs.length > 0 && completedOrFailed.length === 0 && (
              <div className="px-6 py-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Your clips will appear here once processing is complete.
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/70 bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <AppButton
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    icon={<ChevronLeftIcon className="h-4 w-4" />}
                    className="h-8 px-3"
                  >
                    Prev
                  </AppButton>
                  <AppButton
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    icon={<ChevronRightIcon className="h-4 w-4" />}
                    iconPosition="right"
                    className="h-8 px-3"
                  >
                    Next
                  </AppButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

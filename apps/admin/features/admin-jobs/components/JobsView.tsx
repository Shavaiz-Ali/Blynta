"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAdminJobsQuery,
  useRetryJobMutation,
} from "@/features/admin-jobs/queries";
import {
  AdminJobItem,
  JobStatus,
  ListJobsParams,
  SourcePlatform,
} from "@/features/admin-jobs/types";
import { DataTable, Column } from "@/components/common/DataTable";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { AppBadge as Badge } from "@/components/common/primitives";
import { AppButton, AppLinkButton } from "@blynta/ui";
import { AppInput as Input } from "@/components/common/primitives";
import { AppSelect as Select } from "@blynta/ui";
import { SelectItem } from "@blynta/ui/primitives/select";
import {
  Briefcase,
  Search,
  Upload,
  ExternalLink,
  Film,
  RotateCw,
  Eye,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6a3 3 0 0 0-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<SourcePlatform, React.ReactNode> = {
  youtube: <YoutubeIcon className="size-3.5 text-primary" />,
  tiktok: <Film className="size-3.5 text-primary" />,
  instagram: <Film className="size-3.5 text-primary" />,
  upload: <Upload className="size-3.5 text-muted-foreground" />,
};

const STATUS_VARIANTS: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  completed: "default",
  transcribing: "secondary",
  detecting_highlights: "secondary",
  cutting_clips: "secondary",
  pending: "outline",
  failed: "destructive",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  completed: "Completed",
  transcribing: "Transcribing",
  detecting_highlights: "AI Highlights",
  cutting_clips: "FFmpeg Render",
  pending: "Pending",
  failed: "Failed",
};

const DEFAULT_PARAMS: ListJobsParams = {
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortOrder: "desc",
};

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const QUICK_FILTERS = [
  { label: "All", val: "" },
  { label: "Completed", val: "completed" },
  { label: "Failed", val: "failed" },
  { label: "Pending", val: "pending" },
  { label: "Transcribing", val: "transcribing" },
  { label: "Cutting Clips", val: "cutting_clips" },
] as const;

export function JobsView() {
  const router = useRouter();
  const [params, setParams] = React.useState<ListJobsParams>(DEFAULT_PARAMS);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | "">("");

  const { data, isLoading, isFetching, isError, refetch } = useAdminJobsQuery({
    ...params,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const retryMutation = useRetryJobMutation();

  const handleRowClick = (job: AdminJobItem) => {
    router.push(`/jobs/${job._id}`);
  };

  const handleRetry = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    retryMutation.mutate(jobId);
  };

  const columns: Column<AdminJobItem>[] = [
    {
      key: "videoTitle",
      header: "Video & Source",
      render: (job) => (
        <div className="flex flex-col min-w-0 max-w-xs">
          <span className="font-semibold text-foreground text-xs truncate">
            {job.videoTitle || "Untitled Processing Job"}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {job.sourcePlatform && PLATFORM_ICONS[job.sourcePlatform]}
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-muted-foreground hover:text-primary truncate max-w-44 flex items-center gap-1"
              >
                {job.sourceUrl.replace(/^https?:\/\//, "").slice(0, 32)}…
                <ExternalLink className="size-2.5 shrink-0" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "userEmail",
      header: "User Account",
      render: (job) => {
        const userObj = typeof job.userId === "object" ? job.userId : null;
        const email =
          userObj?.email ||
          job.userEmail ||
          (typeof job.userId === "string" ? job.userId : "—");
        return (
          <div className="flex flex-col min-w-0 max-w-[180px]">
            <span className="text-xs text-foreground font-medium truncate">
              {email}
            </span>
            {userObj?.plan && (
              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                {userObj.plan}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Processing Status",
      sortable: true,
      render: (job) => (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <Badge
            variant={STATUS_VARIANTS[job.status]}
            className="text-[11px] w-fit capitalize font-mono"
          >
            {STATUS_LABELS[job.status] || job.status}
          </Badge>
          {!["completed", "failed"].includes(job.status) && (
            <div className="space-y-0.5">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${job.progressPercent || 20}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {job.progressPercent || 0}%
              </span>
            </div>
          )}
          {job.status === "failed" && job.errorMessage && (
            <span
              className="text-[11px] text-destructive/90 truncate max-w-40 font-mono"
              title={job.errorMessage}
            >
              {job.errorMessage.slice(0, 35)}…
            </span>
          )}
        </div>
      ),
    },
    {
      key: "clipsCount",
      header: "Clips",
      render: (job) => (
        <Badge
          variant="outline"
          className="tabular-nums font-mono text-xs font-semibold"
        >
          {job.clips?.length ?? job.clipsCount ?? 0}
        </Badge>
      ),
    },
    {
      key: "videoDuration",
      header: "Duration",
      render: (job) => (
        <span className="text-xs text-muted-foreground tabular-nums font-mono">
          {formatDuration(job.videoDuration)}
        </span>
      ),
    },
    {
      key: "stylePreset",
      header: "Subtitle Preset",
      render: (job) => (
        <Badge
          variant="secondary"
          className="text-[10px] capitalize font-medium"
        >
          {job.stylePreset || "default"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (job) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (job) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {job.status === "failed" && (
            <AppButton
              variant="outline"
              size="xs"
              onClick={(e) => handleRetry(e, job._id)}
              disabled={retryMutation.isPending}
              className="gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
              title="Re-queue failed job"
            >
              <RotateCw
                className={`size-3 ${retryMutation.isPending ? "animate-spin" : ""}`}
              />
              Retry
            </AppButton>
          )}
          <AppLinkButton
            variant="ghost"
            size="icon-xs"
            render={<Link href={`/jobs/${job._id}`} />}
            title="Open job details"
            aria-label={`Open details for ${job.videoTitle || job._id}`}
          >
            <Eye className="size-3.5" />
          </AppLinkButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Briefcase className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Global Job Monitor
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track multi-stage AI video ingestion, transcription, highlight
              detection, and FFmpeg renders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {data?.meta?.total !== undefined
              ? `${data.meta.total.toLocaleString()} Total Jobs`
              : "Loading..."}
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input - using shadcn Input */}
          <div className="relative w-full min-w-0 flex-1 sm:min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by video title, URL, or user email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParams((p) => ({ ...p, page: 1 }));
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status Select - using shadcn Select */}
          <Select
            aria-label="Job status"
            size="sm"
            wrapperClassName="w-full sm:w-40"
            value={statusFilter || "all"}
            onValueChange={(val) => {
              setStatusFilter(val === "all" ? "" : (val as JobStatus));
              setParams((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="transcribing">Transcribing</SelectItem>
            <SelectItem value="detecting_highlights">AI Highlights</SelectItem>
            <SelectItem value="cutting_clips">FFmpeg Render</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </Select>
        </div>

        {/* Quick Filter Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain border-t border-border/60 pt-2 text-xs">
          <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
            <Filter className="size-3" /> Quick Filter:
          </span>
          {QUICK_FILTERS.map((pill) => (
            <AppButton
              key={pill.label}
              onClick={() => {
                setStatusFilter(pill.val as JobStatus | "");
                setParams((p) => ({ ...p, page: 1 }));
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                statusFilter === pill.val
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {pill.label}
            </AppButton>
          ))}
        </div>
      </div>

      {/* Main Jobs Table */}
      {isError ? (
        <QueryErrorState
          title="Jobs could not be loaded"
          description="The global processing monitor is unavailable. No empty job list is being shown in its place."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : (
        <DataTable<AdminJobItem>
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          emptyMessage="No video processing jobs match the selected filter."
          onRowClick={handleRowClick}
          pagination={{
            page: params.page ?? 1,
            limit: params.limit ?? 25,
            total: data?.meta?.total ?? 0,
            totalPages: data?.meta?.totalPages ?? 1,
            onPageChange: (page) => setParams((p) => ({ ...p, page })),
            onLimitChange: (limit) =>
              setParams((p) => ({ ...p, limit, page: 1 })),
          }}
          sorting={{
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            onSortChange: (sortBy, sortOrder) =>
              setParams((p) => ({ ...p, sortBy, sortOrder })),
          }}
        />
      )}
    </div>
  );
}

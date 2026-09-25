"use client";

import * as React from "react";
import { useAdminJobsQuery } from "@/features/admin-jobs/queries";
import { AdminJobItem, JobStatus, ListJobsParams, SourcePlatform } from "@/features/admin-jobs/types";
import { DataTable, Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { AppCard } from "@/components/common/AppCard";
import { Briefcase, Search, Upload, ExternalLink, Film } from "lucide-react";

// Youtube inline SVG since lucide-react doesn't export a Youtube icon
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6a3 3 0 0 0-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
    </svg>
  );
}
import { formatDistanceToNow, format } from "date-fns";

const STATUS_VARIANTS: Record<JobStatus, "default" | "secondary" | "outline" | "destructive"> = {
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
  detecting_highlights: "Detecting",
  cutting_clips: "Cutting",
  pending: "Pending",
  failed: "Failed",
};

const PLATFORM_ICONS: Record<SourcePlatform, React.ReactNode> = {
  youtube: <YoutubeIcon className="size-3.5 text-red-500" />,
  tiktok: <Film className="size-3.5 text-pink-500" />,
  instagram: <Film className="size-3.5 text-purple-500" />,
  upload: <Upload className="size-3.5 text-muted-foreground" />,
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

const columns: Column<AdminJobItem>[] = [
  {
    key: "videoTitle",
    header: "Job",
    render: (job) => (
      <div className="flex flex-col min-w-0 max-w-xs">
        <span className="font-medium text-foreground text-sm truncate">
          {job.videoTitle || "Untitled"}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {PLATFORM_ICONS[job.sourcePlatform]}
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-primary truncate max-w-40 flex items-center gap-1"
          >
            {job.sourceUrl.replace(/^https?:\/\//, "").slice(0, 35)}…
            <ExternalLink className="size-2.5 shrink-0" />
          </a>
        </div>
      </div>
    ),
  },
  {
    key: "userEmail",
    header: "User",
    render: (job) => (
      <span className="text-xs text-muted-foreground">{job.userEmail || job.userId}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (job) => (
      <div className="flex flex-col gap-1">
        <Badge variant={STATUS_VARIANTS[job.status]} className="text-xs w-fit">
          {STATUS_LABELS[job.status]}
        </Badge>
        {job.status !== "completed" && job.status !== "failed" && (
          <div className="w-20 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
        )}
        {job.status === "failed" && job.errorMessage && (
          <span className="text-xs text-destructive/80 truncate max-w-36" title={job.errorMessage}>
            {job.errorMessage.slice(0, 40)}…
          </span>
        )}
      </div>
    ),
  },
  {
    key: "clipsCount",
    header: "Clips",
    render: (job) => (
      <span className="tabular-nums font-medium">{job.clipsCount}</span>
    ),
  },
  {
    key: "videoDuration",
    header: "Duration",
    render: (job) => (
      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(job.videoDuration)}</span>
    ),
  },
  {
    key: "stylePreset",
    header: "Style",
    render: (job) => (
      <Badge variant="outline" className="text-xs capitalize">{job.stylePreset || "default"}</Badge>
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
];

export function JobsView() {
  const [params, setParams] = React.useState<ListJobsParams>(DEFAULT_PARAMS);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | "">("");

  const { data, isLoading } = useAdminJobsQuery({
    ...params,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Briefcase className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {data?.meta?.total !== undefined ? `${data.meta.total.toLocaleString()} total jobs` : "Video processing pipeline"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, URL, or user email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParams((p) => ({ ...p, page: 1 }));
              }}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as JobStatus | "");
              setParams((p) => ({ ...p, page: 1 }));
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="transcribing">Transcribing</option>
            <option value="detecting_highlights">Detecting Highlights</option>
            <option value="cutting_clips">Cutting Clips</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <DataTable<AdminJobItem>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No jobs found."
        pagination={{
          page: params.page ?? 1,
          limit: params.limit ?? 25,
          total: data?.meta?.total ?? 0,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: (page) => setParams((p) => ({ ...p, page })),
          onLimitChange: (limit) => setParams((p) => ({ ...p, limit, page: 1 })),
        }}
        sorting={{
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          onSortChange: (sortBy, sortOrder) => setParams((p) => ({ ...p, sortBy, sortOrder })),
        }}
      />
    </div>
  );
}

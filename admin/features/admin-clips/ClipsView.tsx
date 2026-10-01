"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminJobsQuery } from "@/features/admin-jobs/queries";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppInput } from "@/components/common/AppInput";
import { AppButton } from "@/components/common/AppButton";
import { DataTable } from "@/components/common/DataTable";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { QueryErrorState } from "@/components/common/QueryErrorState";

export function ClipsView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useAdminJobsQuery({ page, limit: 25, search, sortBy: "createdAt", sortOrder: "desc" });
  const clips = query.data?.data.flatMap((job) =>
    (job.clips || []).map((clip) => ({
      ...clip,
      jobId: job._id,
      title: job.videoTitle || job._id,
      owner: typeof job.userId === "object" ? job.userId.email : job.userEmail || job.userId,
    }))
  ) || [];

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Generated clips"
        description="Inspect generated videos and open their parent jobs in a full detail page."
      />
      <AppInput
        label="Find parent jobs"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search video title or source"
      />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            data={clips}
            loading={query.isLoading}
            emptyMessage="No clips in this page of jobs. Try another page or search."
            onRowClick={(clip) => router.push(`/jobs/${clip.jobId}`)}
            columns={[
              {
                key: "title",
                header: "Parent job",
                render: (clip) => (
                  <Link className="font-medium text-primary hover:underline" href={`/jobs/${clip.jobId}`}>
                    {clip.title}
                  </Link>
                ),
              },
              { key: "owner", header: "Owner" },
              { key: "status", header: "Status", render: (clip) => <AppStatusBadge status={clip.status || "unknown"} /> },
              { key: "duration", header: "Duration", render: (clip) => `${Math.max(0, clip.endTime - clip.startTime).toFixed(1)}s` },
              {
                key: "preview",
                header: "Preview",
                render: (clip) => clip.outputUrl && /^https?:\/\//i.test(clip.outputUrl)
                  ? <video className="w-48 rounded-md" controls preload="none" src={clip.outputUrl} aria-label={`Preview clip from ${clip.title}`} />
                  : "Preview unavailable",
              },
            ]}
          />
          <div className="flex items-center gap-3 text-sm">
            <AppButton variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous jobs</AppButton>
            <span>Job page {page} / {Math.max(1, query.data?.meta.totalPages || 1)}</span>
            <AppButton variant="outline" disabled={page >= (query.data?.meta.totalPages || 1) || query.isFetching} onClick={() => setPage(page + 1)}>Next jobs</AppButton>
          </div>
        </>
      )}
    </div>
  );
}

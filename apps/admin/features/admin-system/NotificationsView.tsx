"use client";
import Link from "next/link";
import { useAdminJobsQuery } from "@/features/admin-jobs/queries";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { DataTable } from "@/components/common/DataTable";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { useState } from "react";
export function NotificationsView() {
  const [page, setPage] = useState(1);
  const query = useAdminJobsQuery({ status: "failed", page, limit: 10 });
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Notifications"
        description="Processing failures requiring attention."
      />
      <p className="text-sm text-muted-foreground">
        These alerts come from failed jobs. Read/unread state, billing alerts,
        and security notifications are not yet connected.
      </p>
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          data={query.data?.data || []}
          loading={query.isLoading}
          emptyMessage="No failed jobs were returned."
          columns={[
            {
              key: "videoTitle",
              header: "Job",
              render: (j) => (
                <Link
                  className="text-primary hover:underline"
                  href={`/jobs/${j._id}`}
                >
                  {j.videoTitle || j._id}
                </Link>
              ),
            },
            { key: "errorMessage", header: "Failure" },
            {
              key: "createdAt",
              header: "Created",
              render: (j) => new Date(j.createdAt).toLocaleString(),
            },
          ]}
          pagination={{
            page,
            limit: 10,
            total: query.data?.meta.total || 0,
            totalPages: query.data?.meta.totalPages || 1,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}

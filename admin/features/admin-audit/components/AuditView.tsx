"use client";

import * as React from "react";
import { useAdminAuditQuery } from "../queries";
import type { AdminAuditLogItem, ListAuditParams } from "../types";
import { DataTable, type Column } from "@/components/common/DataTable";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  AppDialog as Dialog,
  AppDialogContent as DialogContent,
  AppDialogDescription as DialogDescription,
  AppDialogHeader as DialogHeader,
  AppDialogTitle as DialogTitle,
} from "@/components/common/primitives";

const DEFAULT_PARAMS: ListAuditParams = {
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortOrder: "desc",
};

const CATEGORIES = ["auth", "job", "billing", "credit", "referral", "account", "system"];

function actorLabel(log: AdminAuditLogItem): string {
  const actor = typeof log.actorId === "object" ? log.actorId : undefined;
  return actor?.email || actor?.name || (typeof log.actorId === "string" ? log.actorId : "System");
}

function targetLabel(log: AdminAuditLogItem): string {
  const user = typeof log.userId === "object" ? log.userId : undefined;
  return user?.email || (typeof log.userId === "string" ? log.userId : "—");
}

export function AuditView() {
  const [params, setParams] = React.useState<ListAuditParams>(DEFAULT_PARAMS);
  const [selected, setSelected] = React.useState<AdminAuditLogItem | null>(null);
  const query = useAdminAuditQuery(params);

  const columns: Column<AdminAuditLogItem>[] = [
    {
      key: "type",
      header: "Event",
      sortable: true,
      render: (log) => (
        <div className="max-w-xs">
          <p className="font-mono text-xs">{log.type}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{log.title}</p>
        </div>
      ),
    },
    { key: "actorId", header: "Actor", render: (log) => actorLabel(log) },
    { key: "userId", header: "Target account", render: (log) => targetLabel(log) },
    { key: "status", header: "Result", render: (log) => <AppStatusBadge status={log.status} /> },
    {
      key: "createdAt",
      header: "Recorded",
      sortable: true,
      render: (log) => <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>,
    },
    {
      key: "inspect",
      header: "",
      render: (log) => <AppButton variant="ghost" size="sm" onClick={() => setSelected(log)}>Inspect</AppButton>,
    },
  ];

  return (
    <div className="space-y-6">
      <AppPageHeader title="Audit logs" description="Administrative actions and system events recorded by the backend." />

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
        <AppInput
          label="Search"
          placeholder="Title or description"
          value={params.search || ""}
          onChange={(event) => setParams((current) => ({ ...current, search: event.target.value || undefined, page: 1 }))}
        />
        <label className="space-y-2 text-sm">
          <span className="block">Category</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            value={params.category || ""}
            onChange={(event) => setParams((current) => ({ ...current, category: event.target.value || undefined, page: 1 }))}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <AppInput label="From" type="date" value={params.startDate || ""} onChange={(event) => setParams((current) => ({ ...current, startDate: event.target.value || undefined, page: 1 }))} />
        <AppInput label="To" type="date" value={params.endDate || ""} onChange={(event) => setParams((current) => ({ ...current, endDate: event.target.value || undefined, page: 1 }))} />
      </div>

      {query.isError ? (
        <QueryErrorState title="Audit activity could not be loaded" description="The activity service did not return the administrative trail." onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.data || []}
          loading={query.isLoading}
          emptyMessage="No audit records match these filters."
          sorting={{ sortBy: params.sortBy, sortOrder: params.sortOrder, onSortChange: (sortBy, sortOrder) => setParams((current) => ({ ...current, sortBy, sortOrder, page: 1 })) }}
          pagination={{ page: params.page || 1, limit: params.limit || 25, total: query.data?.meta.total || 0, totalPages: query.data?.meta.totalPages || 1, onPageChange: (page) => setParams((current) => ({ ...current, page })), onLimitChange: (limit) => setParams((current) => ({ ...current, limit, page: 1 })) }}
        />
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || "Audit event"}</DialogTitle>
            <DialogDescription>{selected?.type} · {selected?._id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Actor</dt><dd>{actorLabel(selected)}</dd></div>
                <div><dt className="text-muted-foreground">Target</dt><dd>{targetLabel(selected)}</dd></div>
                <div><dt className="text-muted-foreground">Category</dt><dd>{selected.category}</dd></div>
                <div><dt className="text-muted-foreground">Recorded</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
              </dl>
              {selected.description && <p>{selected.description}</p>}
              <details><summary className="cursor-pointer text-muted-foreground">Metadata</summary><pre className="mt-3 max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{JSON.stringify(selected.metadata || {}, null, 2)}</pre></details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

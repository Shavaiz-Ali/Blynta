"use client";

import * as React from "react";
import { useAdminAuditQuery } from "@/features/admin-audit/queries";
import { AdminAuditLogItem, ListAuditParams } from "@/features/admin-audit/types";
import { DataTable, Column } from "@/components/common/DataTable";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const DEFAULT_PARAMS: ListAuditParams = {
  page: 1,
  limit: 25,
  sortOrder: "desc",
};

function ChangesCell({ changes }: { changes?: Record<string, { before: unknown; after: unknown }> }) {
  const [open, setOpen] = React.useState(false);
  if (!changes || Object.keys(changes).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const keys = Object.keys(changes);

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {keys.length} field{keys.length > 1 ? "s" : ""} changed
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 rounded border border-border bg-muted/30 px-3 py-2 text-xs font-mono space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground w-24 truncate shrink-0">{k}:</span>
              <span className="text-destructive/80 line-through">{String(changes[k].before ?? "—")}</span>
              <span className="text-green-500">{String(changes[k].after ?? "—")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const columns: Column<AdminAuditLogItem>[] = [
  {
    key: "action",
    header: "Action",
    render: (log) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {log.action}
      </Badge>
    ),
  },
  {
    key: "adminEmail",
    header: "Admin",
    render: (log) => (
      <span className="text-xs text-muted-foreground">{log.adminEmail || log.adminId}</span>
    ),
  },
  {
    key: "targetType",
    header: "Target",
    render: (log) =>
      log.targetType ? (
        <div className="flex flex-col gap-0.5">
          <Badge variant="outline" className="text-xs capitalize w-fit">{log.targetType}</Badge>
          {log.targetId && (
            <span className="font-mono text-xs text-muted-foreground">{log.targetId.slice(0, 12)}…</span>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "reason",
    header: "Reason",
    render: (log) => (
      <span className="text-sm text-foreground max-w-xs truncate block" title={log.reason}>
        {log.reason}
      </span>
    ),
  },
  {
    key: "changes",
    header: "Changes",
    render: (log) => <ChangesCell changes={log.changes} />,
  },
  {
    key: "createdAt",
    header: "Time",
    render: (log) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
      </span>
    ),
  },
];

export function AuditView() {
  const [params, setParams] = React.useState<ListAuditParams>(DEFAULT_PARAMS);
  const [actionFilter, setActionFilter] = React.useState("");

  const { data, isLoading } = useAdminAuditQuery({
    ...params,
    action: actionFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            {data?.meta?.total !== undefined ? `${data.meta.total.toLocaleString()} entries` : "All admin actions, immutable"}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Filter by action (e.g. user.update)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setParams((p) => ({ ...p, page: 1 }));
            }}
            className="flex-1 min-w-52 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable<AdminAuditLogItem>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No audit log entries found."
        pagination={{
          page: params.page ?? 1,
          limit: params.limit ?? 25,
          total: data?.meta?.total ?? 0,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: (page) => setParams((p) => ({ ...p, page })),
          onLimitChange: (limit) => setParams((p) => ({ ...p, limit, page: 1 })),
        }}
      />
    </div>
  );
}

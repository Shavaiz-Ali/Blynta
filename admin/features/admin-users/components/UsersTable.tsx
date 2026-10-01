"use client";
import { DataTable, type DataTableProps } from "@/components/common/DataTable";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import type { AdminUserItem } from "../types";
export type UsersTableProps = DataTableProps<AdminUserItem>;
export function UsersTable(props: Omit<UsersTableProps, "columns">) {
  return <DataTable {...props} columns={[
    { key: "email", header: "Account", sortable: true, render: u => <span className="flex flex-col"><span>{u.name || u.email}</span><span className="text-xs text-muted-foreground">{u.email}</span></span> },
    { key: "role", header: "Role", render: u => <AppStatusBadge status={u.role} /> },
    { key: "plan", header: "Plan", sortable: true, render: u => <AppStatusBadge status={u.plan} /> },
    { key: "isActive", header: "Status", render: u => <AppStatusBadge status={u.isActive ? "active" : "suspended"} /> },
    { key: "creditsBalance", header: "Credits", sortable: true },
    { key: "totalCreditsUsed", header: "Used" },
    { key: "createdAt", header: "Joined", sortable: true, render: u => new Date(u.createdAt).toLocaleDateString() },
  ]} />;
}

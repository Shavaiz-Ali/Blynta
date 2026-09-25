"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminUserItem } from "../types";
import { formatDistanceToNow } from "date-fns";
import {
  Zap,
  Briefcase,
  Coins,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserX,
} from "lucide-react";
import { cn } from "cn";

const planConfig: Record<string, { label: string; className: string }> = {
  free: { label: "Free", className: "border-border text-muted-foreground" },
  pro: { label: "Pro", className: "border-primary/30 bg-primary/10 text-primary" },
  business: {
    label: "Business",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
};

export interface UsersTableProps {
  data: AdminUserItem[];
  loading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
  sorting: {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  };
  onRowClick: (user: AdminUserItem) => void;
}

function SortIcon({ column, sortBy, sortOrder }: { column: string; sortBy?: string; sortOrder?: "asc" | "desc" }) {
  if (sortBy !== column) return <ArrowUpDown className="size-3.5 text-muted-foreground/50 ml-1 inline-block" />;
  return sortOrder === "asc"
    ? <ArrowUp className="size-3.5 text-primary ml-1 inline-block" />
    : <ArrowDown className="size-3.5 text-primary ml-1 inline-block" />;
}

export function UsersTable({ data, loading, pagination, sorting, onRowClick }: UsersTableProps) {
  const handleSort = (column: string) => {
    if (sorting.sortBy === column) {
      sorting.onSortChange(column, sorting.sortOrder === "asc" ? "desc" : "asc");
    } else {
      sorting.onSortChange(column, "desc");
    }
  };

  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="pl-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              User
            </TableHead>
            <TableHead
              className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("plan")}
            >
              Plan
              <SortIcon column="plan" sortBy={sorting.sortBy} sortOrder={sorting.sortOrder} />
            </TableHead>
            <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </TableHead>
            <TableHead
              className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("creditsBalance")}
            >
              Credits
              <SortIcon column="creditsBalance" sortBy={sorting.sortBy} sortOrder={sorting.sortOrder} />
            </TableHead>
            <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verified
            </TableHead>
            <TableHead
              className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("createdAt")}
            >
              Joined
              <SortIcon column="createdAt" sortBy={sorting.sortBy} sortOrder={sorting.sortOrder} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                <TableCell className="pl-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UserX className="size-8 opacity-40" />
                  <p className="text-sm">No users found. Try adjusting your filters.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((user) => {
              const plan = planConfig[user.plan] ?? { label: user.plan, className: "border-border text-muted-foreground" };
              return (
                <TableRow
                  key={user._id}
                  className="border-border cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => onRowClick(user)}
                >
                  {/* User */}
                  <TableCell className="pl-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm select-none">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{user.name || "—"}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Plan */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("gap-1 text-xs font-medium capitalize px-2", plan.className)}
                    >
                      {user.plan === "pro" && <Zap className="size-3" />}
                      {user.plan === "business" && <Briefcase className="size-3" />}
                      {plan.label}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "inline-block size-1.5 rounded-full",
                        user.isActive ? "bg-emerald-500" : "bg-destructive"
                      )} />
                      <span className={cn(
                        "text-xs font-medium",
                        user.isActive ? "text-emerald-500" : "text-destructive"
                      )}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Credits */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 tabular-nums text-xs">
                      <Coins className="size-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium text-foreground">{user.creditsBalance.toLocaleString()}</span>
                      <span className="text-muted-foreground">/ {user.totalCreditsUsed.toLocaleString()} used</span>
                    </div>
                  </TableCell>

                  {/* Verified */}
                  <TableCell>
                    <Badge
                      variant={user.emailVerified ? "default" : "outline"}
                      className="text-xs"
                    >
                      {user.emailVerified ? "Yes" : "No"}
                    </Badge>
                  </TableCell>

                  {/* Joined */}
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {!loading && data.length > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
            <span className="font-medium text-foreground">{pagination.total.toLocaleString()}</span> users
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

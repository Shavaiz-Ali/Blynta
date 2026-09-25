"use client";

import * as React from "react";
import { useDashboardStatsQuery } from "@/features/admin-dashboard/queries";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Briefcase,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  DollarSign,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

export function DashboardView() {
  const { data, isLoading } = useDashboardStatsQuery();

  const formatMrr = (cents?: number) => {
    if (cents === undefined || cents === null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform overview — auto-refreshes every 2 min</p>
      </div>

      {/* Users row */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="size-3.5" /> Users
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total Users"
            value={data?.users?.total !== undefined ? data.users.total.toLocaleString() : "—"}
            icon={<Users className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Active Users"
            value={data?.users?.active !== undefined ? data.users.active.toLocaleString() : "—"}
            description="accounts not banned"
            icon={<Activity className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="New This Week"
            value={data?.users?.newThisWeek !== undefined ? data.users.newThisWeek.toLocaleString() : "—"}
            trend={
              data?.users?.newThisWeek !== undefined
                ? {
                    value: `+${data.users.newThisWeek}`,
                    positive: data.users.newThisWeek > 0,
                    label: "last 7 days",
                  }
                : undefined
            }
            icon={<TrendingUp className="size-4" />}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Jobs row */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Briefcase className="size-3.5" /> Jobs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Jobs"
            value={data?.jobs?.total !== undefined ? data.jobs.total.toLocaleString() : "—"}
            icon={<Briefcase className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Completed Today"
            value={data?.jobs?.completedToday !== undefined ? data.jobs.completedToday.toLocaleString() : "—"}
            icon={<CheckCircle2 className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Failed Today"
            value={data?.jobs?.failedToday !== undefined ? data.jobs.failedToday.toLocaleString() : "—"}
            trend={
              data?.jobs?.failedToday !== undefined
                ? { value: data.jobs.failedToday, positive: data.jobs.failedToday === 0 }
                : undefined
            }
            icon={<AlertTriangle className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Queue Pending"
            value={data?.jobs?.pending !== undefined ? data.jobs.pending.toLocaleString() : "—"}
            description="in queue now"
            icon={<Clock className="size-4" />}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Billing row */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <CreditCard className="size-3.5" /> Billing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Subscriptions"
            value={data?.billing?.activeSubscriptions !== undefined ? data.billing.activeSubscriptions.toLocaleString() : "—"}
            icon={<CreditCard className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="MRR"
            value={data?.billing?.mrr !== undefined ? formatMrr(data.billing.mrr) : "—"}
            description="monthly recurring revenue"
            icon={<DollarSign className="size-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Past Due"
            value={data?.billing?.pastDue !== undefined ? data.billing.pastDue.toLocaleString() : "—"}
            trend={
              data?.billing?.pastDue !== undefined
                ? { value: data.billing.pastDue, positive: data.billing.pastDue === 0 }
                : undefined
            }
            icon={<AlertTriangle className="size-4" />}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Recent audit log */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <ShieldAlert className="size-3.5" /> Recent Admin Actions
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : data?.recentAudit && data.recentAudit.length > 0 ? (
                data.recentAudit.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="font-mono text-xs shrink-0">
                        {entry.action}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.reason}</p>
                        {entry.adminEmail && (
                          <p className="text-xs text-muted-foreground">{entry.adminEmail}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No recent admin actions.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

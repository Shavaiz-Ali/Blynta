"use client";

import * as React from "react";
import { useAdminCustomersQuery, useAdminEventsQuery } from "@/features/admin-billing/queries";
import { ListCustomersParams, ListEventsParams, SubStatus } from "@/features/admin-billing/types";
import { DataTable, Column } from "@/components/common/DataTable";
import { AdminCustomerItem, AdminSubscriptionEvent } from "@/features/admin-billing/types";
import { Badge } from "@/components/ui/badge";
import { AppCard } from "@/components/common/AppCard";
import { AppTabs } from "@/components/common/AppTabs";
import { CreditCard, Zap, Search, ArrowUpDown } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  canceled: "destructive",
  paused: "outline",
};

const DEFAULT_CUSTOMER_PARAMS: ListCustomersParams = {
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortOrder: "desc",
};

const DEFAULT_EVENT_PARAMS: ListEventsParams = {
  page: 1,
  limit: 25,
  sortOrder: "desc",
};

const customerColumns: Column<AdminCustomerItem>[] = [
  {
    key: "userEmail",
    header: "User",
    render: (c) => (
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-foreground truncate">{c.userName || "—"}</span>
        <span className="text-xs text-muted-foreground truncate">{c.userEmail}</span>
      </div>
    ),
  },
  {
    key: "paddleCustomerId",
    header: "Paddle Customer",
    render: (c) => (
      <span className="font-mono text-xs text-muted-foreground">{c.paddleCustomerId}</span>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    sortable: true,
    render: (c) => <Badge variant="outline" className="text-xs capitalize">{c.plan}</Badge>,
  },
  {
    key: "paddleSubscriptionStatus",
    header: "Sub Status",
    render: (c) =>
      c.paddleSubscriptionStatus ? (
        <Badge
          variant={STATUS_VARIANTS[c.paddleSubscriptionStatus] ?? "outline"}
          className="text-xs capitalize"
        >
          {c.paddleSubscriptionStatus}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "currentBillingPeriodEndsAt",
    header: "Billing Period Ends",
    render: (c) =>
      c.currentBillingPeriodEndsAt ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(c.currentBillingPeriodEndsAt), "MMM d, yyyy")}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "paddleScheduledChangeAction",
    header: "Scheduled Change",
    render: (c) =>
      c.paddleScheduledChangeAction ? (
        <Badge variant="outline" className="text-xs capitalize">
          {c.paddleScheduledChangeAction}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    render: (c) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
      </span>
    ),
  },
];

const eventColumns: Column<AdminSubscriptionEvent>[] = [
  {
    key: "eventType",
    header: "Event",
    render: (e) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {e.eventType}
      </Badge>
    ),
  },
  {
    key: "userEmail",
    header: "User",
    render: (e) => (
      <span className="text-xs text-muted-foreground truncate">{e.userEmail || e.userId}</span>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    render: (e) =>
      e.plan ? (
        <Badge variant="outline" className="text-xs capitalize">{e.plan}</Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (e) =>
      e.status ? (
        <Badge
          variant={STATUS_VARIANTS[e.status] ?? "outline"}
          className="text-xs capitalize"
        >
          {e.status}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "creditsDelta",
    header: "Credits Δ",
    render: (e) =>
      e.creditsDelta !== undefined && e.creditsDelta !== null ? (
        <span
          className={
            e.creditsDelta > 0
              ? "text-green-500 font-semibold tabular-nums"
              : e.creditsDelta < 0
              ? "text-destructive font-semibold tabular-nums"
              : "text-muted-foreground tabular-nums"
          }
        >
          {e.creditsDelta > 0 ? "+" : ""}
          {e.creditsDelta}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Time",
    render: (e) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(e.createdAt), "MMM d, yyyy h:mm a")}
      </span>
    ),
  },
];

export function BillingView() {
  const [activeTab, setActiveTab] = React.useState("customers");
  const [customerParams, setCustomerParams] = React.useState(DEFAULT_CUSTOMER_PARAMS);
  const [eventParams, setEventParams] = React.useState(DEFAULT_EVENT_PARAMS);
  const [statusFilter, setStatusFilter] = React.useState<SubStatus | "">("");
  const [search, setSearch] = React.useState("");

  const { data: customerData, isLoading: customersLoading } = useAdminCustomersQuery({
    ...customerParams,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const { data: eventData, isLoading: eventsLoading } = useAdminEventsQuery(eventParams);

  const tabs = [
    { value: "customers", label: "Customers" },
    { value: "events", label: "Subscription Events" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CreditCard className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Paddle customers and subscription events</p>
        </div>
      </div>

      {/* Tabs */}
      <AppTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
      />

      {activeTab === "customers" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email or paddle ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCustomerParams((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SubStatus | "")}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due</option>
                <option value="paused">Paused</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
          </div>

          <DataTable<AdminCustomerItem>
            columns={customerColumns}
            data={customerData?.data ?? []}
            loading={customersLoading}
            emptyMessage="No customers found."
            pagination={{
              page: customerParams.page ?? 1,
              limit: customerParams.limit ?? 25,
              total: customerData?.meta?.total ?? 0,
              totalPages: customerData?.meta?.totalPages ?? 1,
              onPageChange: (page) => setCustomerParams((p) => ({ ...p, page })),
              onLimitChange: (limit) => setCustomerParams((p) => ({ ...p, limit, page: 1 })),
            }}
            sorting={{
              sortBy: customerParams.sortBy,
              sortOrder: customerParams.sortOrder,
              onSortChange: (sortBy, sortOrder) =>
                setCustomerParams((p) => ({ ...p, sortBy, sortOrder })),
            }}
          />
        </div>
      )}

      {activeTab === "events" && (
        <DataTable<AdminSubscriptionEvent>
          columns={eventColumns}
          data={eventData?.data ?? []}
          loading={eventsLoading}
          emptyMessage="No subscription events found."
          pagination={{
            page: eventParams.page ?? 1,
            limit: eventParams.limit ?? 25,
            total: eventData?.meta?.total ?? 0,
            totalPages: eventData?.meta?.totalPages ?? 1,
            onPageChange: (page) => setEventParams((p) => ({ ...p, page })),
            onLimitChange: (limit) => setEventParams((p) => ({ ...p, limit, page: 1 })),
          }}
        />
      )}
    </div>
  );
}

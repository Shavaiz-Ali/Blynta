"use client";
import { useState } from "react";
import {
  useAdminCustomersQuery,
  useCancelSubscriptionMutation,
} from "../queries";
import type {
  AdminCustomerItem,
  ListCustomersParams,
  SubStatus,
} from "../types";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppInput } from "@blynta/ui";
import { AppButton } from "@blynta/ui";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { AppTabs } from "@blynta/ui";
import { DataTable } from "@/components/common/DataTable";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogFooter,
} from "@/components/common/primitives";
import { AdjustCreditsDialog } from "@/features/admin-users/components/AdjustCreditsDialog";

function getCustomerUserId(customer: AdminCustomerItem): string {
  return typeof customer.userId === "string"
    ? customer.userId
    : customer.userId._id;
}

function getCustomerLabel(customer: AdminCustomerItem): string {
  if (customer.userEmail) return customer.userEmail;
  if (typeof customer.userId !== "string") {
    return customer.userId.email || customer.userId.name || customer.userId._id;
  }
  return customer.userId;
}

export function BillingView() {
  const [tab, setTab] = useState("subscriptions");
  const [params, setParams] = useState<ListCustomersParams>({
    page: 1,
    limit: 25,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [credits, setCredits] = useState<AdminCustomerItem | null>(null);
  const [cancel, setCancel] = useState<AdminCustomerItem | null>(null);
  const [reason, setReason] = useState("");
  const query = useAdminCustomersQuery(params);
  const mutation = useCancelSubscriptionMutation();
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Billing"
        description="Paddle subscriptions and customer credit balances."
      />
      <AppTabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "subscriptions", label: "Subscriptions" },
          { value: "plans", label: "Plans" },
          { value: "transactions", label: "Transactions" },
        ]}
      />
      {tab !== "subscriptions" ? (
        <section className="rounded-lg border p-6">
          <h2 className="font-medium">
            {tab === "plans"
              ? "Plan catalog not connected"
              : "Transaction feed not connected"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "plans"
              ? "Assigned plans are visible on subscriptions. Plan prices, limits, and editing are managed outside this console."
              : "Payment transactions and webhook events are not available from the current admin API."}
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-56 flex-1">
              <AppInput
                label="Search customers"
                value={params.search || ""}
                onChange={(e) =>
                  setParams({ ...params, search: e.target.value, page: 1 })
                }
              />
            </div>
            <label className="space-y-2 text-sm">
              <span className="block">Subscription status</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={params.status || ""}
                onChange={(e) =>
                  setParams({
                    ...params,
                    status: (e.target.value || undefined) as
                      SubStatus | undefined,
                    page: 1,
                  })
                }
              >
                <option value="">All statuses</option>
                {["active", "trialing", "past_due", "paused", "canceled"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          {query.isError ? (
            <QueryErrorState onRetry={() => void query.refetch()} />
          ) : (
            <DataTable
              data={query.data?.data || []}
              loading={query.isLoading}
              columns={[
                {
                  key: "userEmail",
                  header: "Customer",
                  render: getCustomerLabel,
                },
                {
                  key: "plan",
                  header: "Plan",
                  render: (c) => <AppStatusBadge status={c.plan} />,
                },
                {
                  key: "paddleSubscriptionStatus",
                  header: "Status",
                  render: (c) => (
                    <AppStatusBadge
                      status={c.paddleSubscriptionStatus || "unknown"}
                    />
                  ),
                },
                {
                  key: "currentBillingPeriodEndsAt",
                  header: "Period ends",
                  render: (c) =>
                    c.currentBillingPeriodEndsAt
                      ? new Date(
                          c.currentBillingPeriodEndsAt,
                        ).toLocaleDateString()
                      : "—",
                },
                {
                  key: "paddleScheduledChangeAction",
                  header: "Scheduled change",
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (c) => (
                    <div className="flex gap-2">
                      <AppButton
                        size="sm"
                        variant="outline"
                        onClick={() => setCredits(c)}
                      >
                        Credits
                      </AppButton>
                      {c.paddleSubscriptionStatus === "active" &&
                        c.paddleScheduledChangeAction !== "cancel" && (
                          <AppButton
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setCancel(c);
                              setReason("");
                            }}
                          >
                            Cancel subscription
                          </AppButton>
                        )}
                    </div>
                  ),
                },
              ]}
              pagination={{
                page: params.page || 1,
                limit: params.limit || 25,
                total: query.data?.meta.total || 0,
                totalPages: query.data?.meta.totalPages || 1,
                onPageChange: (page) => setParams({ ...params, page }),
                onLimitChange: (limit) =>
                  setParams({ ...params, limit, page: 1 }),
              }}
            />
          )}
        </>
      )}
      <AdjustCreditsDialog
        userId={credits ? getCustomerUserId(credits) : null}
        userEmail={credits ? getCustomerLabel(credits) : undefined}
        open={!!credits}
        onOpenChange={(open) => !open && setCredits(null)}
      />
      <AppDialog
        open={!!cancel}
        onOpenChange={(open) => !open && !mutation.isPending && setCancel(null)}
      >
        <AppDialogContent>
          <AppDialogHeader>
            <AppDialogTitle>Cancel subscription?</AppDialogTitle>
            <AppDialogDescription>
              Schedule cancellation for{" "}
              {cancel ? getCustomerLabel(cancel) : "this customer"} at the end
              of the current billing period. Access remains until then.
            </AppDialogDescription>
          </AppDialogHeader>
          <AppInput
            label="Audit reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <AppDialogFooter>
            <AppButton
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setCancel(null)}
            >
              Keep subscription
            </AppButton>
            <AppButton
              variant="destructive"
              isLoading={mutation.isPending}
              disabled={!reason.trim()}
              onClick={() =>
                cancel &&
                mutation.mutate(
                  {
                    userId: getCustomerUserId(cancel),
                    payload: { immediately: false, reason: reason.trim() },
                  },
                  { onSuccess: () => setCancel(null) },
                )
              }
            >
              Confirm cancellation
            </AppButton>
          </AppDialogFooter>
        </AppDialogContent>
      </AppDialog>
    </div>
  );
}

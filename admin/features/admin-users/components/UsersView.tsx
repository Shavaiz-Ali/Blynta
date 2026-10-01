"use client";

import * as React from "react";
import { useAdminUsersQuery, useAdminUserDetailQuery } from "@/features/admin-users/queries";
import { UsersTable } from "@/features/admin-users/components/UsersTable";
import { UsersFilterBar } from "@/features/admin-users/components/UsersFilterBar";
import { UserDetailCard } from "@/features/admin-users/components/UserDetailCard";
import { EditUserDialog } from "@/features/admin-users/components/EditUserDialog";
import { CreateAdminDialog } from "@/features/admin-users/components/CreateAdminDialog";
import { AdjustCreditsDialog } from "@/features/admin-users/components/AdjustCreditsDialog";
import { AdminUserItem, ListUsersParams } from "@/features/admin-users/types";
import { AppButton as Button } from "@/components/common/primitives";
import { AppSkeleton as Skeleton } from "@/components/common/primitives";
import { AppBadge as Badge } from "@/components/common/primitives";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { X, Pencil, Users, ShieldPlus, Coins } from "lucide-react";

const DEFAULT_FILTERS: ListUsersParams = {
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortOrder: "desc",
  role: "user", // only list regular users by default
};

export function UsersView() {
  const [filters, setFilters] = React.useState<ListUsersParams>(DEFAULT_FILTERS);
  const [selectedUser, setSelectedUser] = React.useState<AdminUserItem | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [createAdminOpen, setCreateAdminOpen] = React.useState(false);
  const [creditsOpen, setCreditsOpen] = React.useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useAdminUsersQuery(filters);
  const { data: detailData, isLoading: detailLoading } = useAdminUserDetailQuery(
    selectedUser?._id ?? ""
  );

  const handleFilterChange = (partial: Partial<ListUsersParams>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const handleReset = () => setFilters(DEFAULT_FILTERS);

  const handleRowClick = (user: AdminUserItem) => {
    setSelectedUser(user);
  };

  const handleCloseDetail = () => {
    setSelectedUser(null);
    setEditOpen(false);
    setCreditsOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">User Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inspect user accounts, manage subscription tiers, roles, and manual credit grants.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {data?.meta?.total !== undefined ? `${data.meta.total.toLocaleString()} Accounts` : "Loading..."}
          </Badge>
          <Button
            onClick={() => setCreateAdminOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ShieldPlus className="size-4" />
            Provision Admin
          </Button>
        </div>
      </div>

      {/* Filters */}
      <UsersFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Table */}
      {isError ? (
        <QueryErrorState
          title="User accounts could not be loaded"
          description="The user service did not return account data. No empty account list is being shown."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : <UsersTable
        data={data?.data ?? []}
        loading={isLoading}
        pagination={{
          page: filters.page ?? 1,
          limit: filters.limit ?? 25,
          total: data?.meta?.total ?? 0,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: (page) => handleFilterChange({ page }),
          onLimitChange: (limit) => handleFilterChange({ limit, page: 1 }),
        }}
        sorting={{
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          onSortChange: (sortBy, sortOrder) => handleFilterChange({ sortBy, sortOrder }),
        }}
        onRowClick={handleRowClick}
      />}

      {/* Detail drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-40 flex" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDetail}
          />

          {/* Drawer panel */}
          <div className="relative ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
            {/* Drawer header */}
            <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {(selectedUser.name || selectedUser.email)[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">{selectedUser.name || "No name"}</h2>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreditsOpen(true)}
                  className="gap-1.5 text-xs text-primary dark:text-primary border-primary/30 bg-primary/10"
                >
                  <Coins className="size-3.5" />
                  <span className="hidden sm:inline">Adjust Credits</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Edit Account</span>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleCloseDetail}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {detailLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                  </div>
                </div>
              ) : detailData ? (
                <UserDetailCard
                  detail={detailData}
                  onAdjustCredits={() => setCreditsOpen(true)}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <EditUserDialog
        key={selectedUser?._id || "no-user"}
        user={selectedUser}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Adjust credits dialog */}
      <AdjustCreditsDialog
        userId={selectedUser?._id ?? null}
        userEmail={selectedUser?.email}
        currentBalance={selectedUser?.creditsBalance ?? 0}
        open={creditsOpen}
        onOpenChange={setCreditsOpen}
      />

      {/* Create admin dialog */}
      <CreateAdminDialog
        open={createAdminOpen}
        onOpenChange={setCreateAdminOpen}
      />
    </div>
  );
}

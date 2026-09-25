"use client";

import * as React from "react";
import { useAdminUsersQuery, useAdminUserDetailQuery } from "@/features/admin-users/queries";
import { UsersTable } from "@/features/admin-users/components/UsersTable";
import { UsersFilterBar } from "@/features/admin-users/components/UsersFilterBar";
import { UserDetailCard } from "@/features/admin-users/components/UserDetailCard";
import { EditUserDialog } from "@/features/admin-users/components/EditUserDialog";
import { CreateAdminDialog } from "@/features/admin-users/components/CreateAdminDialog";
import { AdminUserItem, ListUsersParams } from "@/features/admin-users/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Pencil, Users, ShieldPlus } from "lucide-react";

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

  const { data, isLoading } = useAdminUsersQuery(filters);
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
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">
              {data?.meta?.total !== undefined
                ? `${data.meta.total.toLocaleString()} total users`
                : "Manage all users"}
            </p>
          </div>
        </div>

        {/* Add Admin button */}
        <Button
          onClick={() => setCreateAdminOpen(true)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <ShieldPlus className="size-4" />
          Add Admin
        </Button>
      </div>

      {/* Filters */}
      <UsersFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Table */}
      <UsersTable
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
      />

      {/* Detail drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-40 flex" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDetail}
          />

          {/* Drawer panel */}
          <div className="relative ml-auto w-full max-w-4xl h-full bg-background shadow-2xl flex flex-col overflow-hidden border-l border-border">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card/50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {(selectedUser.name || selectedUser.email)[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{selectedUser.name || "No name"}</h2>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="gap-1.5"
                >
                  <Pencil className="size-3.5" />
                  Edit
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
            <div className="flex-1 overflow-y-auto p-6">
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
                <UserDetailCard detail={detailData} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <EditUserDialog
        user={selectedUser}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Create admin dialog */}
      <CreateAdminDialog
        open={createAdminOpen}
        onOpenChange={setCreateAdminOpen}
      />
    </div>
  );
}

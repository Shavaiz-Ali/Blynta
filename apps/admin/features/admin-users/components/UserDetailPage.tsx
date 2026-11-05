"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdminUserDetailQuery } from "../queries";
import { UserDetailCard } from "./UserDetailCard";
import { EditUserDialog } from "./EditUserDialog";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppSpinner, AppButton, AppLinkButton } from "@blynta/ui";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { ArrowLeft, Pencil } from "lucide-react";

export function UserDetailPage({ id }: { id: string }) {
  const query = useAdminUserDetailQuery(id);
  const [edit, setEdit] = useState(false);
  return (
    <div className="space-y-6">
      <AppLinkButton
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
        render={<Link href="/users" />}
      >
        <ArrowLeft className="size-4" />
        Back to users
      </AppLinkButton>

      <AppPageHeader
        title={query.data?.user.name || "Account details"}
        description={
          query.data?.user.email ||
          "Account, subscription, usage, and activity."
        }
        action={
          <AppButton
            disabled={!query.data}
            onClick={() => setEdit(true)}
            className="h-8 text-xs font-semibold shadow-xs"
          >
            <Pencil className="size-3.5 mr-1" />
            Edit account
          </AppButton>
        }
      />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <AppSpinner />
      ) : query.data ? (
        <UserDetailCard detail={query.data} />
      ) : (
        <p>Account not found.</p>
      )}
      <EditUserDialog
        key={query.data?.user._id || "loading"}
        user={query.data?.user || null}
        open={edit}
        onOpenChange={setEdit}
      />
    </div>
  );
}
